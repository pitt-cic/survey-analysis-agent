"""
Lambda handler for processing CSV chunks and generating embeddings.

This Lambda function:
1. Receives SQS messages containing CSV chunk metadata
2. Downloads and reads the specific CSV chunk from S3
3. Generates embeddings using EmbeddingStore (Bedrock Titan)
4. Uploads vectors to S3 Vectors
5. Deletes SQS message on success or allows retry on failure
"""

import os
import uuid
from typing import Any

import pandas as pd
from botocore.exceptions import ClientError

from backend.core.services.embeddings_service import EmbeddingStore
from backend.core.utils import get_client
from backend.core.utils.logger import get_logger
from backend.core.utils.request import parse_sqs_event, validate_numeric_range
from backend.core.utils.response import success_response

logger = get_logger(__name__)

# Initialize AWS clients
s3_client = get_client("s3")
bedrock_client = get_client("bedrock-runtime")

# Required fields for chunk metadata
CHUNK_REQUIRED_FIELDS = [
    "s3_bucket",
    "s3_key",
    "start_row",
    "end_row",
    "chunk_number",
    "total_chunks",
]


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """
    Main Lambda handler for processing SQS messages with CSV chunk metadata.

    Args:
        event: SQS event containing Records with CSV chunk metadata
        _context: Lambda context object

    Returns:
        dict with statusCode and body

    Raises:
        ValueError: For invalid message format (non-retriable)
        ClientError: For AWS service errors (may be retriable)
        Exception: For unexpected errors (retriable)
    """
    try:
        # Parse SQS event and validate required fields
        chunk_metadata = parse_sqs_event(event, required_fields=CHUNK_REQUIRED_FIELDS)

        # Validate row range
        validate_numeric_range(chunk_metadata, "start_row", "end_row")

        logger.info(
            "Processing chunk",
            chunk_number=chunk_metadata["chunk_number"] + 1,
            total_chunks=chunk_metadata["total_chunks"],
            start_row=chunk_metadata["start_row"],
            end_row=chunk_metadata["end_row"],
        )

        # Process the CSV chunk
        result = process_csv_chunk(
            bucket=chunk_metadata["s3_bucket"],
            key=chunk_metadata["s3_key"],
            start_row=chunk_metadata["start_row"],
            end_row=chunk_metadata["end_row"],
            chunk_number=chunk_metadata["chunk_number"],
        )

        logger.info(
            "Successfully processed chunk",
            chunk_number=chunk_metadata["chunk_number"],
            result=result,
        )

        return success_response(body=result)

    except (ValueError, KeyError) as e:
        # Non-retriable errors (invalid message format)
        logger.error("Validation error (non-retriable)", error=str(e), exc_info=True)
        raise

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")

        if error_code == "NoSuchKey":
            # CSV file isn't found - non-retriable
            logger.error("CSV file not found (non-retriable)", error_code=error_code)
            raise

        # Other AWS errors are retriable (throttling, network, etc.)
        logger.error("AWS error (retriable)", error_code=error_code, exc_info=True)
        raise

    except Exception as e:
        # Unexpected errors - retriable
        logger.exception("Unexpected error (retriable)")
        raise


def read_csv_chunk(bucket: str, key: str, start_row: int, end_row: int) -> pd.DataFrame:
    """
    Download CSV from S3 and read only the specified row range.

    Uses pandas skiprows and nrows for memory-efficient reading of large CSVs.

    Args:
        bucket: S3 bucket name
        key: S3 object key
        start_row: Starting row number (0-indexed, inclusive)
        end_row: Ending row number (0-indexed, exclusive)

    Returns:
        DataFrame containing only the specified rows

    Raises:
        ClientError: If S3 download fails
        Exception: If CSV parsing fails
    """
    local_path = f"/tmp/{uuid.uuid4()}.csv"

    try:
        logger.info(
            "Downloading from S3", bucket=bucket, key=key, local_path=local_path
        )
        s3_client.download_file(bucket, key, local_path)

        # Calculate number of rows to read
        num_rows = end_row - start_row

        if start_row == 0:
            # Read from beginning (preserve header)
            logger.info(
                "Reading rows from beginning",
                start_row=0,
                end_row=end_row,
                num_rows=num_rows,
            )
            df = pd.read_csv(local_path, nrows=num_rows)
        else:
            # Skip header + rows before start_row
            # skiprows expects 0-indexed row numbers
            # Row 0 is header, so skip rows 1 to start_row (inclusive)
            logger.info(
                "Reading rows with skip",
                start_row=start_row,
                end_row=end_row,
                skip_data_rows=start_row,
            )
            df = pd.read_csv(
                local_path, skiprows=range(1, start_row + 1), nrows=num_rows
            )

        logger.info("Read rows from CSV", rows_read=len(df))
        return df

    finally:
        # Always cleanup temp file
        if os.path.exists(local_path):
            os.remove(local_path)
            logger.debug("Cleaned up temp file", local_path=local_path)


def process_csv_chunk(
    bucket: str, key: str, start_row: int, end_row: int, chunk_number: int
) -> dict[str, Any]:
    """
    Process a CSV chunk by generating embeddings and uploading to S3 Vectors.

    Args:
        bucket: S3 bucket name
        key: S3 object key
        start_row: Starting row number (0-indexed, inclusive)
        end_row: Ending row number (0-indexed, exclusive)
        chunk_number: Chunk number (for logging)

    Returns:
        dict with processing statistics

    Raises:
        Exception: If embedding generation or upload fails
    """
    # Read CSV chunk
    df = read_csv_chunk(bucket, key, start_row, end_row)

    # Extract CSV name (without extension) for vector keys
    csv_name = os.path.splitext(os.path.basename(key))[0]

    # Initialize EmbeddingStore
    embedding_store = EmbeddingStore(bedrock_client)

    # Generate embeddings with absolute row numbering
    # Pass start_row as row_offset to ensure unique vector keys across chunks
    logger.info("Generating embeddings", csv_name=csv_name, row_offset=start_row)

    embedding_store.add_dataframe(
        df=df,
        csv_name=csv_name,
        max_rows=len(df),  # Process all rows in this chunk
        row_offset=start_row,  # Absolute row numbering
    )

    return {
        "chunk_number": chunk_number,
        "rows_processed": len(df),
        "start_row": start_row,
        "end_row": end_row,
        "csv_name": csv_name,
    }
