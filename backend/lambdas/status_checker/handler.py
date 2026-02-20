"""
Lambda handler for job status checking.
Returns job status and result from DynamoDB.
"""

import uuid
from typing import Any

from backend.core.services.job_service import JobService, JobStatus
from backend.core.utils.logger import get_logger
from backend.core.utils.request import extract_path_parameter, is_options_request
from backend.core.utils.response import (
    error_response,
    options_response,
    success_response,
)

logger = get_logger(__name__)

# Initialize service at module level
job_service = JobService()


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle job status requests."""
    # Handle OPTIONS preflight
    if is_options_request(event):
        return options_response(use_api_cors=True)

    # Generate request ID
    request_id = str(uuid.uuid4())

    try:
        # Extract job ID from path
        try:
            job_id = extract_path_parameter(event, "jobId")
        except KeyError:
            logger.warning("Missing jobId in path", request_id=request_id)
            return error_response(
                error="Missing jobId in path",
                status_code=400,
                error_type="ValidationError",
                include_cors=True,
                use_api_cors=True,
                extra_headers={"X-Request-Id": request_id},
            )

        # Get a job from DynamoDB
        job = job_service.get_job(job_id)

        if not job:
            logger.warning("Job not found", job_id=job_id, request_id=request_id)
            return error_response(
                error=f"Job {job_id} not found",
                status_code=404,
                error_type="NotFound",
                include_cors=True,
                use_api_cors=True,
                extra_headers={"X-Request-Id": request_id},
            )

        # Build response based on status
        status = job.get("status")
        response_body: dict[str, Any] = {
            "jobId": job_id,
            "status": status,
            "createdAt": job.get("createdAt"),
            "updatedAt": job.get("updatedAt"),
        }

        # Include a result if completed
        if status == JobStatus.COMPLETED.value and "result" in job:
            response_body["result"] = job["result"]

        # Include error if failed
        if status == JobStatus.FAILED.value and "error" in job:
            response_body["error"] = job["error"]

        # Build extra headers
        extra_headers = {"X-Request-Id": request_id}

        # Add Retry-After for non-terminal states
        if status in (JobStatus.PENDING.value, JobStatus.PROCESSING.value):
            extra_headers["Retry-After"] = "3"

        logger.info("Returning job status", job_id=job_id, status=status)

        return success_response(
            body=response_body,
            status_code=200,
            include_cors=True,
            use_api_cors=True,
            extra_headers=extra_headers,
        )

    except Exception:  # pylint: disable=broad-exception-caught
        logger.exception("Error getting job status", request_id=request_id)
        return error_response(
            error="Internal server error",
            status_code=500,
            error_type="InternalError",
            include_cors=True,
            use_api_cors=True,
            extra_headers={"X-Request-Id": request_id},
        )
