"""Lambda handler for S3 CSV upload events - chunks CSVs and sends to SQS."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd

from backend.core.utils import get_client
from backend.core.utils.logger import get_logger
from backend.core.utils.request import parse_s3_event
from backend.core.utils.response import success_response, error_response

logger = get_logger(__name__)

# Initialize AWS clients
s3_client = get_client("s3")
sqs_client = get_client("sqs")

# Configuration from environment
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "500"))
CHUNK_QUEUE_URL = os.environ.get("CHUNK_QUEUE_URL")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """
    Handle S3 ObjectCreated events for CSV uploads.

    Reads CSV file from S3, chunks it into CHUNK_SIZE-row batches,
    and sends messages to SQS queue for downstream processing.

    Args:
        event: S3 event notification
        _context: Lambda context object

    Returns:
        Response dict with statusCode and body
    """
    try:
        # Validate configuration
        if not CHUNK_QUEUE_URL:
            logger.error("CHUNK_QUEUE_URL environment variable not set")
            return error_response(
                error="Missing CHUNK_QUEUE_URL configuration", status_code=500
            )

        logger.info(
            "Starting CSV upload processing",
            chunk_size=CHUNK_SIZE,
            queue_url=CHUNK_QUEUE_URL,
        )

        # Process each S3 record in the event
        total_chunks_sent = 0

        for record in event.get("Records", []):
            # Parse S3 event details using utility (handles URL decoding)
            s3_details = parse_s3_event(record)

            logger.info(
                "Processing S3 event",
                event_name=s3_details["event_name"],
                bucket=s3_details["s3_bucket"],
                key=s3_details["s3_key"],
                size_bytes=s3_details["s3_size"],
            )

            # Process the CSV file
            chunks_sent = process_csv_file(
                s3_details["s3_bucket"], s3_details["s3_key"]
            )
            total_chunks_sent += chunks_sent

            logger.info(
                "CSV file processed", key=s3_details["s3_key"], chunks_sent=chunks_sent
            )

        return success_response(
            body={
                "message": "CSV upload processed successfully",
                "total_chunks_sent": total_chunks_sent,
            }
        )

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.exception("Error processing S3 event")
        return error_response(error=str(e), status_code=500)


def process_csv_file(bucket: str, key: str) -> int:
    """
    Download CSV from S3, chunk it, and send messages to SQS.

    Args:
        bucket: S3 bucket name
        key: S3 object key

    Returns:
        Number of chunks sent to SQS

    Raises:
        Exception: If file download, parsing, or SQS send fails
    """
    # Download CSV from S3 to /tmp
    local_path = f"/tmp/{os.path.basename(key)}"

    try:
        logger.info(
            "Downloading file from S3", bucket=bucket, key=key, local_path=local_path
        )
        s3_client.download_file(bucket, key, local_path)
        logger.info("Downloaded CSV", local_path=local_path)
    except s3_client.exceptions.NoSuchKey as exc:
        logger.error("File not found in S3", bucket=bucket, key=key)
        raise FileNotFoundError(f"S3 object not found: {key}") from exc
    except Exception:
        logger.exception("Failed to download from S3")
        raise

    # Read CSV with pandas
    try:
        logger.info("Reading CSV file", local_path=local_path)
        df = pd.read_csv(local_path)
        total_rows = len(df)
        logger.info("Read CSV", total_rows=total_rows)

        # Check for empty CSV
        if total_rows == 0:
            logger.warning("CSV file is empty", key=key)
            return 0

    except pd.errors.EmptyDataError:
        logger.warning("CSV file is empty or has no data", key=key)
        return 0
    except pd.errors.ParserError as e:
        logger.error("Failed to parse CSV", error=str(e))
        raise ValueError(f"CSV parsing error: {str(e)}") from e
    except Exception:
        logger.exception("Failed to read CSV")
        raise

    # Calculate chunks
    total_chunks = (total_rows + CHUNK_SIZE - 1) // CHUNK_SIZE
    logger.info("Creating chunks", total_chunks=total_chunks, chunk_size=CHUNK_SIZE)

    # Create chunk messages
    messages = []
    timestamp = datetime.now(timezone.utc).isoformat()

    for chunk_num in range(total_chunks):
        start_row = chunk_num * CHUNK_SIZE
        end_row = min(start_row + CHUNK_SIZE, total_rows)

        message = {
            "s3_bucket": bucket,
            "s3_key": key,
            "start_row": start_row,
            "end_row": end_row,
            "chunk_number": chunk_num,
            "total_rows": total_rows,
            "total_chunks": total_chunks,
            "timestamp": timestamp,
        }

        messages.append(message)
        logger.debug(
            "Chunk created",
            chunk_number=chunk_num,
            start_row=start_row,
            end_row=end_row - 1,
        )

    # Send messages to SQS in batches of 10 (SQS limit)
    chunks_sent = send_messages_to_sqs(messages)

    # Clean up temporary file
    try:
        os.remove(local_path)
        logger.debug("Removed temporary file", local_path=local_path)
    except OSError as e:
        logger.warning(
            "Failed to remove temporary file", local_path=local_path, error=str(e)
        )

    return chunks_sent


def send_messages_to_sqs(messages: List[Dict[str, Any]]) -> int:
    """
    Send messages to SQS in batches of 10 (API limit).

    Args:
        messages: List of message dictionaries to send

    Returns:
        Number of messages successfully sent

    Raises:
        Exception: If SQS send fails
    """
    total_sent = 0
    batch = []
    batch_number = 1

    for msg in messages:
        batch.append({"Id": str(uuid.uuid4()), "MessageBody": json.dumps(msg)})

        # Send batch when it reaches 10 messages
        if len(batch) == 10:
            logger.info(
                "Sending batch to SQS",
                batch_number=batch_number,
                chunks_start=total_sent,
                chunks_end=total_sent + len(batch) - 1,
            )
            send_batch(batch)
            total_sent += len(batch)
            batch = []
            batch_number += 1

    # Send remaining messages
    if batch:
        logger.info(
            "Sending batch to SQS",
            batch_number=batch_number,
            chunks_start=total_sent,
            chunks_end=total_sent + len(batch) - 1,
        )
        send_batch(batch)
        total_sent += len(batch)

    logger.info("Successfully sent messages to SQS", total_sent=total_sent)
    return total_sent


def send_batch(batch: List[Dict[str, str]]) -> None:
    """
    Send a single batch of messages to SQS.

    Args:
        batch: List of message entries (max 10)

    Raises:
        Exception: If SQS send fails
    """
    try:
        response = sqs_client.send_message_batch(
            QueueUrl=CHUNK_QUEUE_URL, Entries=batch
        )

        # Check for failures
        failed = response.get("Failed", [])
        if failed:
            logger.error(
                "Failed to send messages", failed_count=len(failed), failed=failed
            )
            raise RuntimeError(f"Failed to send {len(failed)} messages to SQS")

        successful = len(response.get("Successful", []))
        logger.debug("Batch sent successfully", successful_count=successful)

    except Exception:
        logger.exception("SQS send_message_batch failed")
        raise
