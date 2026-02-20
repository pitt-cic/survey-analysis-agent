"""
Lambda handler for job initiation.
Creates job in DynamoDB and invokes agent Lambda asynchronously.
"""

import json
import os
import uuid
from typing import Any

from backend.core.services.job_service import JobService, JobStatus
from backend.core.utils import get_client
from backend.core.utils.logger import get_logger
from backend.core.utils.request import (
    extract_header,
    is_options_request,
    parse_api_gateway_body,
    validate_required_fields,
)
from backend.core.utils.response import (
    error_response,
    options_response,
    success_response,
)

logger = get_logger(__name__)

# Initialize services at module level
job_service = JobService()
lambda_client = get_client("lambda")

AGENT_LAMBDA_NAME = os.environ.get("AGENT_LAMBDA_NAME", "survey-analysis-agent")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle job creation requests."""
    # Handle OPTIONS preflight
    if is_options_request(event):
        return options_response(use_api_cors=True)

    # Generate request ID
    request_id = str(uuid.uuid4())

    try:
        # Parse and validate request
        try:
            body = parse_api_gateway_body(event)
        except ValueError as e:
            logger.warning(
                "Request validation failed", error=str(e), request_id=request_id
            )
            return error_response(
                error=str(e),
                status_code=400,
                error_type="ValidationError",
                include_cors=True,
                use_api_cors=True,
                extra_headers={"X-Request-Id": request_id},
            )

        try:
            validate_required_fields(body, ["query"])
            query = body["query"]
        except KeyError as e:
            logger.warning(
                "Missing required field", error=str(e), request_id=request_id
            )
            return error_response(
                error=str(e),
                status_code=400,
                error_type="ValidationError",
                include_cors=True,
                use_api_cors=True,
                extra_headers={"X-Request-Id": request_id},
            )

        # Check for an idempotency key (case-insensitive header extraction)
        idempotency_key = extract_header(event, "X-Idempotency-Key")

        # Create a job
        job = job_service.create_job(query=query, idempotency_key=idempotency_key)
        job_id = job["jobId"]

        # Invoke agent Lambda asynchronously
        payload = {"jobId": job_id, "query": query, "retryCount": 0}
        lambda_client.invoke(
            FunctionName=AGENT_LAMBDA_NAME,
            InvocationType="Event",
            Payload=json.dumps(payload),
        )
        logger.info(
            "Created job and invoked agent",
            job_id=job_id,
            agent_lambda=AGENT_LAMBDA_NAME,
        )

        # Return 202 Accepted
        return success_response(
            body={
                "jobId": job_id,
                "status": JobStatus.PENDING.value,
                "createdAt": job["createdAt"],
                "links": {"self": f"/jobs/{job_id}"},
            },
            status_code=202,
            include_cors=True,
            use_api_cors=True,
            extra_headers={
                "Location": f"/jobs/{job_id}",
                "X-Request-Id": request_id,
                "Retry-After": "3",
            },
        )
    except Exception:  # pylint: disable=broad-exception-caught
        logger.exception("Error creating job", request_id=request_id)
        return error_response(
            error="Internal server error",
            status_code=500,
            error_type="InternalError",
            include_cors=True,
            use_api_cors=True,
            extra_headers={"X-Request-Id": request_id},
        )
