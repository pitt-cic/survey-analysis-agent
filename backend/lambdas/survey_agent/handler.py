"""
Lambda handler for survey analysis agent.
Handles async job invocations from Job Initiator Lambda.
"""

import json
import time
from typing import Any

from backend.core.agents.survey_agent import init_agent, run_query_with_citations
from backend.core.services.job_service import JobService, JobStatus
from backend.core.services.s3_output_service import S3OutputService
from backend.core.utils import get_client
from backend.core.utils.logger import get_logger
from backend.core.utils.request import parse_async_lambda_event
from backend.core.utils.response import async_error_response, async_response

logger = get_logger(__name__)

# Initialize at the module level for connection reuse
survey_agent, embedding_store = init_agent()
job_service = JobService()
s3_output_service = S3OutputService()
lambda_client = get_client("lambda")

logger.info("Agent initialized")

MAX_RETRIES = 1


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handle async job invocations from Job Initiator."""
    try:
        # Parse and validate async Lambda event
        payload = parse_async_lambda_event(event, required_fields=["jobId", "query"])
        job_id = payload["jobId"]
        query = payload["query"]
        retry_count = payload.get("retryCount", 0)
    except KeyError as e:
        logger.error(
            "Invalid invocation - missing required field", error=str(e), event=event
        )
        return async_error_response(error=str(e), status_code=400)

    return _handle_async_job(job_id, query, retry_count, context)


def _handle_async_job(
    job_id: str, query: str, retry_count: int, context: Any
) -> dict[str, Any]:
    """Handle async job invocation from Job Initiator."""
    logger.info("Processing async job", job_id=job_id, retry_count=retry_count)

    # Update status to PROCESSING
    job_service.update_status(job_id, JobStatus.PROCESSING)

    start_time = time.time()

    try:
        # Run agent query
        result = run_query_with_citations(survey_agent, embedding_store, query)

        execution_time_ms = int((time.time() - start_time) * 1000)

        # Upload cited responses to S3
        cited_responses_ref = s3_output_service.upload_csv_to_s3(
            job_id=job_id,
            filename="cited_responses.csv",
            data=result["cited_responses"],
        )

        # Upload search results to S3
        search_results_ref = s3_output_service.upload_csv_to_s3(
            job_id=job_id,
            filename="search_results.csv",
            data=result["search_results"],
        )

        # Build result payload with S3 references
        job_result = {
            "response": result["response"],
            "cited_responses": cited_responses_ref,
            "search_results": search_results_ref,
            "metadata": {
                "execution_time_ms": execution_time_ms,
                "cited_count": result["cited_count"],
            },
        }

        # Mark job as completed
        job_service.complete_job(job_id, job_result)

        logger.info("Job completed", job_id=job_id, execution_time_ms=execution_time_ms)
        return async_response(body={"success": True, "jobId": job_id})

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.exception("Error processing job", job_id=job_id)

        # Check if we should retry
        if retry_count < MAX_RETRIES:
            logger.info("Retrying job", job_id=job_id, attempt=retry_count + 1)

            # Re-invoke self with incremented retry count
            lambda_client.invoke(
                FunctionName=context.function_name,
                InvocationType="Event",
                Payload=json.dumps(
                    {"jobId": job_id, "query": query, "retryCount": retry_count + 1}
                ),
            )
            return async_response(body={"retrying": True, "jobId": job_id})

        # Max retries exceeded, mark as failed
        job_service.fail_job(job_id, str(e))
        logger.error(
            "Job failed after max retries",
            job_id=job_id,
            total_attempts=retry_count + 1,
        )
        return async_error_response(error=f"Job {job_id} failed", status_code=500)
