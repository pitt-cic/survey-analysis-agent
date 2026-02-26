"""
Lambda handler for survey analysis agent.
Handles async job invocations from Job Initiator Lambda.
"""

import time
from typing import Any

from backend.core.agents.survey_agent import init_agent, run_query_with_citations
from backend.core.services.job_service import JobService, JobStatus
from backend.core.services.s3_output_service import S3OutputService
from backend.core.utils.logger import get_logger
from backend.core.utils.request import parse_async_lambda_event
from backend.core.utils.response import async_error_response, async_response

logger = get_logger(__name__)

# Initialize at the module level for connection reuse
survey_agent, embedding_store = init_agent()
job_service = JobService()
s3_output_service = S3OutputService()

logger.info("Agent initialized")

MAX_RETRIES = 3
RETRY_BASE_DELAY_SECONDS = 2


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle async job invocations from Job Initiator."""
    try:
        # Parse and validate async Lambda event
        payload = parse_async_lambda_event(event, required_fields=["jobId", "query"])
        job_id = payload["jobId"]
        query = payload["query"]
    except KeyError as e:
        logger.error(
            "Invalid invocation - missing required field", error=str(e), event=event
        )
        return async_error_response(error=str(e), status_code=400)

    return _handle_async_job(job_id, query)


def _handle_async_job(job_id: str, query: str) -> dict[str, Any]:
    """Handle async job invocation from Job Initiator."""
    logger.info("Processing async job", job_id=job_id)
    job_service.update_status(job_id, JobStatus.PROCESSING)

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            logger.info(
                "Retrying job",
                job_id=job_id,
                attempt=attempt + 1,
                delay_seconds=RETRY_BASE_DELAY_SECONDS,
            )
            time.sleep(RETRY_BASE_DELAY_SECONDS)

        start_time = time.time()

        try:
            result = run_query_with_citations(survey_agent, embedding_store, query)
            execution_time_ms = int((time.time() - start_time) * 1000)

            # Upload results to S3
            cited_responses_ref = s3_output_service.upload_csv_to_s3(
                job_id=job_id,
                filename="cited_responses.csv",
                data=result["cited_responses"],
            )
            search_results_ref = s3_output_service.upload_csv_to_s3(
                job_id=job_id,
                filename="search_results.csv",
                data=result["search_results"],
            )

            job_result = {
                "response": result["response"],
                "cited_responses": cited_responses_ref,
                "search_results": search_results_ref,
                "metadata": {
                    "execution_time_ms": execution_time_ms,
                    "cited_count": result["cited_count"],
                    "attempt": attempt + 1,
                },
            }

            job_service.complete_job(job_id, job_result)
            logger.info(
                "Job completed",
                job_id=job_id,
                execution_time_ms=execution_time_ms,
                attempt=attempt + 1,
            )
            return async_response(body={"success": True, "jobId": job_id})

        except Exception as e:  # pylint: disable=broad-exception-caught
            last_error = e
            logger.warning(
                "Error processing job",
                job_id=job_id,
                attempt=attempt + 1,
                error=str(e),
                exc_info=True,
            )

    # All retries exhausted
    job_service.fail_job(job_id, str(last_error))
    logger.error(
        "Job failed after max retries", job_id=job_id, total_attempts=MAX_RETRIES + 1
    )
    return async_error_response(error=f"Job {job_id} failed", status_code=500)
