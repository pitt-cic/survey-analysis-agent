"""Job service for DynamoDB operations."""

import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any

import boto3
from botocore.exceptions import ClientError

from backend.core.utils.logger import get_logger


def convert_floats_to_decimal(obj: Any) -> Any:
    """Recursively convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    return obj


def convert_decimal_to_native(obj: Any) -> Any:
    """Recursively convert Decimal values to int/float for JSON compatibility."""
    if isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: convert_decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_decimal_to_native(item) for item in obj]
    return obj


logger = get_logger(__name__)


class JobStatus(str, Enum):
    """Enum representing possible job statuses."""

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobService:
    """Service for managing jobs in DynamoDB."""

    def __init__(self, table_name: str | None = None):
        self.table_name = table_name or os.environ.get(
            "JOBS_TABLE_NAME", "survey-analysis-jobs"
        )
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(self.table_name)

    def create_job(
        self, query: str, idempotency_key: str | None = None
    ) -> dict[str, Any]:
        """Create a new job record.

        Args:
            query: The user's query
            idempotency_key: Optional key to prevent duplicate submissions

        Returns:
            Job record dict
        """
        # Check idempotency key if provided
        if idempotency_key:
            existing = self._get_by_idempotency_key(idempotency_key)
            if existing:
                logger.info(
                    "Returning existing job for idempotency key: %s", idempotency_key
                )
                return existing

        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        ttl = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())

        item = {
            "jobId": job_id,
            "status": JobStatus.PENDING.value,
            "query": query,
            "retryCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "ttl": ttl,
        }

        if idempotency_key:
            item["idempotencyKey"] = idempotency_key

        self.table.put_item(Item=item)
        logger.info("Created job: %s", job_id)
        return item

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Get a job by ID.

        Args:
            job_id: The job ID

        Returns:
            Job record dict or None if not found
        """
        try:
            response = self.table.get_item(Key={"jobId": job_id})
            item = response.get("Item")
            if item:
                return convert_decimal_to_native(item)
            return None
        except ClientError as e:
            logger.error("Error getting job %s: %s", job_id, e)
            return None

    def update_status(self, job_id: str, status: JobStatus) -> bool:
        """Update job status.

        Args:
            job_id: The job ID
            status: New status

        Returns:
            True if successful
        """
        now = datetime.now(timezone.utc).isoformat()
        try:
            self.table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET #status = :status, updatedAt = :now",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={":status": status.value, ":now": now},
            )
            logger.info("Updated job %s status to %s", job_id, status.value)
            return True
        except ClientError as e:
            logger.error("Error updating job %s: %s", job_id, e)
            return False

    def complete_job(self, job_id: str, result: dict[str, Any]) -> bool:
        """Mark job as completed with result.

        Args:
            job_id: The job ID
            result: The result data

        Returns:
            True if successful
        """
        now = datetime.now(timezone.utc).isoformat()
        # Convert floats to Decimal for DynamoDB compatibility
        dynamo_result = convert_floats_to_decimal(result)
        try:
            self.table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET #status = :status, #result = :result, updatedAt = :now",
                ExpressionAttributeNames={"#status": "status", "#result": "result"},
                ExpressionAttributeValues={
                    ":status": JobStatus.COMPLETED.value,
                    ":result": dynamo_result,
                    ":now": now,
                },
            )
            logger.info("Completed job %s", job_id)
            return True
        except ClientError as e:
            logger.error("Error completing job %s: %s", job_id, e)
            return False

    def fail_job(self, job_id: str, error: str) -> bool:
        """Mark job as failed with error.

        Args:
            job_id: The job ID
            error: Error message

        Returns:
            True if successful
        """
        now = datetime.now(timezone.utc).isoformat()
        try:
            self.table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET #status = :status, #error = :error, updatedAt = :now",
                ExpressionAttributeNames={"#status": "status", "#error": "error"},
                ExpressionAttributeValues={
                    ":status": JobStatus.FAILED.value,
                    ":error": error,
                    ":now": now,
                },
            )
            logger.info("Failed job %s: %s", job_id, error)
            return True
        except ClientError as e:
            logger.error("Error failing job %s: %s", job_id, e)
            return False

    def increment_retry(self, job_id: str) -> int:
        """Increment retry count and return new value.

        Args:
            job_id: The job ID

        Returns:
            New retry count
        """
        now = datetime.now(timezone.utc).isoformat()
        try:
            response = self.table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET retryCount = retryCount + :inc, updatedAt = :now",
                ExpressionAttributeValues={":inc": 1, ":now": now},
                ReturnValues="UPDATED_NEW",
            )
            return int(response["Attributes"]["retryCount"])
        except ClientError as e:
            logger.error("Error incrementing retry for job %s: %s", job_id, e)
            return -1

    def _get_by_idempotency_key(self, idempotency_key: str) -> dict[str, Any] | None:
        """Get job by idempotency key using scan (acceptable for low volume)."""
        try:
            response = self.table.scan(
                FilterExpression="idempotencyKey = :key",
                ExpressionAttributeValues={":key": idempotency_key},
                Limit=1,
            )
            items = response.get("Items", [])
            return items[0] if items else None
        except ClientError as e:
            logger.error("Error scanning for idempotency key: %s", e)
            return None
