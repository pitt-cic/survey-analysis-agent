"""Service for uploading output files to S3."""

import csv
import io
import os
from typing import Any

import boto3

from backend.core.utils.logger import get_logger

logger = get_logger(__name__)

# Presigned URL expiry: 24 hours (matches job TTL)
URL_EXPIRY_SECONDS = 86400


class S3OutputService:  # pylint: disable=too-few-public-methods
    """Service for uploading CSV output files to S3."""

    def __init__(self, bucket_name: str | None = None):
        self.bucket_name = bucket_name or os.environ.get(
            "OUTPUT_BUCKET_NAME", "survey-agent-data"
        )
        self.s3_client = boto3.client("s3")

    def _generate_csv_content(self, data: list[dict[str, Any]]) -> str:
        """Generate CSV content from a list of dictionaries.

        Args:
            data: List of dictionaries with consistent keys

        Returns:
            CSV content as a string
        """
        if not data:
            return ""

        output = io.StringIO()
        fieldnames = list(data[0].keys())
        writer = csv.DictWriter(
            output, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL
        )
        writer.writeheader()
        writer.writerows(data)
        return output.getvalue()

    def upload_csv_to_s3(
        self,
        job_id: str,
        filename: str,
        data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Upload CSV data to S3 and return presigned URL with metadata.

        Args:
            job_id: The job ID (used in S3 key path)
            filename: The filename (e.g., 'cited_responses.csv')
            data: List of dictionaries to convert to CSV

        Returns:
            Dict with s3_url, row_count, and file_size_bytes
        """
        if not data:
            return {
                "s3_url": "",
                "row_count": 0,
                "file_size_bytes": 0,
            }

        csv_content = self._generate_csv_content(data)
        csv_bytes = csv_content.encode("utf-8")
        s3_key = f"output/{job_id}/{filename}"

        # Upload to S3
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=s3_key,
            Body=csv_bytes,
            ContentType="text/csv",
        )

        # Generate presigned URL
        presigned_url = self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": s3_key},
            ExpiresIn=URL_EXPIRY_SECONDS,
        )

        logger.info(
            "Uploaded CSV to S3",
            job_id=job_id,
            file_name=filename,
            row_count=len(data),
            file_size_bytes=len(csv_bytes),
        )

        return {
            "s3_url": presigned_url,
            "row_count": len(data),
            "file_size_bytes": len(csv_bytes),
        }
