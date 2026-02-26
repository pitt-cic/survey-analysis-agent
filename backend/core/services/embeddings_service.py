"""Service for managing survey response embeddings with S3 Vectors and AWS Titan."""

import json
import os
import time
from typing import Any

import pandas as pd
from botocore.exceptions import ClientError

from backend.core.utils.agent_utils import generate_random_id
from backend.core.utils.aws_client_service import get_client
from backend.core.utils.logger import get_logger

logger = get_logger(__name__)


def generate_uid() -> str:
    """Generate a random 7-character unique ID."""
    return generate_random_id(7)


class EmbeddingStore:  # pylint: disable=too-many-instance-attributes
    """Manages embeddings storage and retrieval using S3 Vectors and AWS Titan."""

    def __init__(self, bedrock_client: Any):
        self.bedrock_client = bedrock_client
        self.s3vectors_client = get_client("s3vectors")
        self.bucket_name = os.environ.get(
            "S3_VECTOR_BUCKET_NAME", "survey-analysis-vectors"
        )
        self.index_name = os.environ.get("S3_VECTOR_INDEX_NAME", "survey-responses")
        self.embed_dimension = int(os.environ.get("TITAN_EMBED_DIMENSION", "1024"))
        self.embed_model = os.environ.get(
            "TITAN_EMBED_MODEL", "amazon.titan-embed-text-v2:0"
        )
        self.rate_limit_retries = int(
            os.environ.get("EMBEDDING_RATE_LIMIT_RETRIES", "5")
        )
        self.detailed_logs = (
            os.environ.get("EMBEDDING_DETAILED_LOGS", "false").lower() == "true"
        )

    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text using AWS Titan."""
        if not text or pd.isna(text):
            return [0.0] * self.embed_dimension

        response = self.bedrock_client.invoke_model(
            modelId=self.embed_model,
            body=json.dumps({"inputText": text}),
            contentType="application/json",
            accept="application/json",
        )

        response_body = json.loads(response["body"].read())
        return response_body["embedding"]

    def _generate_embedding_with_retry(
        self, text: str, text_id: str = ""
    ) -> tuple[list[float] | None, bool]:
        """Generate embedding with retry logic for rate limiting."""
        if not text or pd.isna(text):
            return [0.0] * self.embed_dimension, True

        for attempt in range(self.rate_limit_retries):
            try:
                response = self.bedrock_client.invoke_model(
                    modelId=self.embed_model,
                    body=json.dumps({"inputText": text}),
                    contentType="application/json",
                    accept="application/json",
                )
                response_body = json.loads(response["body"].read())
                return response_body["embedding"], True

            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")

                if error_code == "ThrottlingException":
                    wait_time = 2**attempt
                    if self.detailed_logs:
                        logger.debug(
                            "Rate limit hit for %s, retry %d/%d, waiting %ds...",
                            text_id,
                            attempt + 1,
                            self.rate_limit_retries,
                            wait_time,
                        )
                    time.sleep(wait_time)
                    continue

                if error_code == "ValidationException":
                    if self.detailed_logs:
                        logger.warning(
                            "Validation error for %s: %s", text_id, str(e)[:100]
                        )
                    return None, False

                wait_time = 2**attempt
                if self.detailed_logs:
                    logger.debug(
                        "Error for %s: %s, retry %d/%d",
                        text_id,
                        error_code,
                        attempt + 1,
                        self.rate_limit_retries,
                    )
                if attempt < self.rate_limit_retries - 1:
                    time.sleep(wait_time)
                    continue
                return None, False

            except Exception as e:  # pylint: disable=broad-exception-caught
                if self.detailed_logs:
                    logger.warning("Unexpected error for %s: %s", text_id, str(e)[:100])
                return None, False

        return None, False

    def _check_existing_vectors(self, keys: list[str]) -> set[str]:
        """Check which vector keys already exist in S3 Vectors.

        GetVectors API has a limit of 100 keys per call, so we batch the requests.
        """
        existing_ids = set()
        batch_size = 100  # S3 Vectors GetVectors limit

        for i in range(0, len(keys), batch_size):
            batch_keys = keys[i : i + batch_size]
            try:
                response = self.s3vectors_client.get_vectors(
                    vectorBucketName=self.bucket_name,
                    indexName=self.index_name,
                    keys=batch_keys,
                    returnData=False,
                    returnMetadata=False,
                )
                for v in response.get("vectors", []):
                    existing_ids.add(v["key"])
            except Exception as e:  # pylint: disable=broad-exception-caught
                if self.detailed_logs:
                    logger.debug("Error checking existing vectors: %s", str(e)[:100])

        return existing_ids

    def _upload_vectors(self, vectors: list[dict]) -> int:
        """Upload vectors to S3 Vectors."""
        if not vectors:
            return 0

        try:
            self.s3vectors_client.put_vectors(
                vectorBucketName=self.bucket_name,
                indexName=self.index_name,
                vectors=vectors,
            )
            logger.info("Uploaded %d vectors to S3", len(vectors))
            return len(vectors)
        except Exception as e:
            logger.error("Error uploading vectors: %s", str(e))
            raise

    def delete_all_vectors(self, csv_name: str, max_count: int = 1000) -> int:
        """Delete all vectors for a given CSV source.

        Args:
            csv_name: The CSV name prefix used when creating vectors
            max_count: Maximum number of vectors to delete

        Returns:
            Number of vectors deleted
        """
        keys_to_delete = [f"{csv_name}_{i}" for i in range(max_count)]
        total_deleted = 0
        batch_size = 500  # S3 Vectors DeleteVectors limit

        for i in range(0, len(keys_to_delete), batch_size):
            batch_keys = keys_to_delete[i : i + batch_size]
            try:
                self.s3vectors_client.delete_vectors(
                    vectorBucketName=self.bucket_name,
                    indexName=self.index_name,
                    keys=batch_keys,
                )
                total_deleted += len(batch_keys)
                logger.info(
                    "Deleted batch of %d vectors (total: %d)",
                    len(batch_keys),
                    total_deleted,
                )
            except Exception as e:  # pylint: disable=broad-exception-caught
                if "NotFound" not in str(e):
                    logger.warning("Error deleting vectors: %s", str(e)[:100])
                break

        logger.info("Deleted %d vectors for %s", total_deleted, csv_name)
        return total_deleted

    def add_dataframe(  # pylint: disable=too-many-locals
        self, df: pd.DataFrame, csv_name: str, max_rows: int = 1000, row_offset: int = 0
    ) -> None:
        """Add embeddings for TEXT_ANSWER column from a DataFrame.

        Args:
            df: DataFrame containing survey responses
            csv_name: Name of the CSV file (used for vector keys)
            max_rows: Maximum number of rows to process
            row_offset: Starting row number for absolute row numbering (for chunked processing)
        """
        # Filter rows with non-empty TEXT_ANSWER
        text_rows = df[df["TEXT_ANSWER"].notna() & (df["TEXT_ANSWER"] != "")].copy()

        # Filter to only include "Text" question types
        if "QUESTION_TYPE" in text_rows.columns:
            text_rows = text_rows[text_rows["QUESTION_TYPE"] == "Text"].copy()

        if len(text_rows) == 0:
            return

        # Limit to first max_rows
        if len(text_rows) > max_rows:
            logger.info(
                "Limiting embeddings to first %d of %d text responses",
                max_rows,
                len(text_rows),
            )
            text_rows = text_rows.head(max_rows)

        # Create unique IDs for each row with absolute row numbering
        text_rows["_embedding_id"] = [
            f"{csv_name}_{row_offset + i}" for i in range(len(text_rows))
        ]

        # Check which IDs already exist in S3 Vectors
        logger.info("Checking for existing vectors...")
        all_ids = [f"{csv_name}_{row_offset + i}" for i in range(len(text_rows))]
        existing_ids = self._check_existing_vectors(all_ids)

        # Filter to only new rows
        new_rows = text_rows[~text_rows["_embedding_id"].isin(existing_ids)]

        if len(new_rows) == 0:
            logger.info("All %d rows already have embeddings", len(text_rows))
            return

        logger.info("Generating embeddings for %d new rows...", len(new_rows))

        # Statistics tracking
        total_processed = 0
        total_failed = 0
        start_time = time.time()

        # Accumulate vectors for upload
        pending_vectors = []

        # Process rows sequentially (parallelism is handled by Lambda instances)
        for _, row in new_rows.iterrows():
            text = row["TEXT_ANSWER"]
            text_id = row["_embedding_id"]

            embedding, success = self._generate_embedding_with_retry(text, text_id)

            if embedding is not None and success:
                # Prepare metadata - keep filterable metadata under 2KB
                # Store full text in text_answer for search results
                text_answer = str(row.get("TEXT_ANSWER", ""))
                metadata = {
                    "uid": generate_uid(),
                    "text_answer": text_answer[:1500],  # Main text for results
                    "question": str(row.get("QUESTION", ""))[:300],
                    "event_name": str(row.get("EVENTNAME", ""))[:100],
                    "event_code": str(row.get("EVENTCODE", "")),
                    "question_type": str(row.get("QUESTION_TYPE", "")),
                    "nps_group": str(row.get("NPS_GROUP", "")),
                    "response_id": str(row.get("RESPONSEID", "")),
                    "csv_source": csv_name,
                }
                pending_vectors.append(
                    {
                        "key": row["_embedding_id"],
                        "data": {"float32": embedding},
                        "metadata": metadata,
                    }
                )
                total_processed += 1
            else:
                total_failed += 1

        # Upload all vectors
        self._upload_vectors(pending_vectors)

        elapsed_time = time.time() - start_time
        success_rate = (total_processed / len(new_rows)) * 100

        logger.info(
            "Embedding generation complete for %s: %d/%d (%.1f%% success), "
            "%d failed, %.1fs (%.1f minutes)",
            csv_name,
            total_processed,
            len(new_rows),
            success_rate,
            total_failed,
            elapsed_time,
            elapsed_time / 60,
        )
        if elapsed_time > 0:
            logger.info(
                "Average speed: %.1f rows/second", total_processed / elapsed_time
            )

    def search(  # pylint: disable=too-many-locals
        self,
        query: str,
        top_k: int = 20,
        filters: dict[str, str] | None = None,
        exclude_uids: list[str] | None = None,
    ) -> pd.DataFrame:
        """Search for similar responses using semantic search.

        Args:
            query: Search query text
            top_k: Number of results to return (max 100 per S3 Vectors API)
            filters: Optional metadata filters (e.g., {'event_name': 'West Virginia'})
            exclude_uids: Optional list of uids to exclude from results using $nin filter

        Returns:
            DataFrame with columns: similarity_score, text_answer, question, event_name, etc.
        """
        # Generate query embedding
        query_embedding = self.generate_embedding(query)

        # Build filter for S3 Vectors
        # S3 Vectors filter syntax: {"field": "value"} or {"$and": [{...}, {...}]}
        metadata_filter = None
        filter_components = []

        # Add user-provided filters
        if filters:
            active_filters = [(key, value) for key, value in filters.items() if value]
            for key, value in active_filters:
                filter_components.append({key: value})

        # Add exclusion filter using $nin operator
        if exclude_uids and len(exclude_uids) > 0:
            filter_components.append({"uid": {"$nin": exclude_uids}})

        # Combine filters with $and if multiple components
        if len(filter_components) > 1:
            metadata_filter = {"$and": filter_components}
        elif len(filter_components) == 1:
            metadata_filter = filter_components[0]

        # Query S3 Vectors
        # API docs: queryVector, topK, returnDistance, returnMetadata, filter
        query_params = {
            "vectorBucketName": self.bucket_name,
            "indexName": self.index_name,
            "queryVector": {"float32": query_embedding},
            "topK": min(top_k, 100),  # S3 Vectors max is 100
            "returnDistance": True,
            "returnMetadata": True,
        }
        if metadata_filter:
            query_params["filter"] = metadata_filter

        try:
            response = self.s3vectors_client.query_vectors(**query_params)
        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error("Error querying S3 Vectors: %s", e)
            return pd.DataFrame()

        # Convert results to DataFrame
        if not response.get("vectors"):
            return pd.DataFrame()

        # Extract metadata and create DataFrame
        # S3 Vectors returns 'distance' (lower is better for cosine)
        # Convert to similarity_score (higher is better): similarity = 1 - distance
        rows = []
        for vector in response["vectors"]:
            metadata = vector.get("metadata", {})
            distance = vector.get("distance", 1.0)

            text_answer = metadata.get("text_answer", "")

            row = {
                "uid": metadata.get("uid", ""),
                "similarity_score": 1.0 - distance,  # Convert distance to similarity
                "text_answer": text_answer,
                "question": metadata.get("question", ""),
                "event_name": metadata.get("event_name", ""),
                "event_code": metadata.get("event_code", ""),
                "question_type": metadata.get("question_type", ""),
                "nps_group": metadata.get("nps_group", ""),
                "response_id": metadata.get("response_id", ""),
                "csv_source": metadata.get("csv_source", ""),
            }
            rows.append(row)

        return pd.DataFrame(rows)
