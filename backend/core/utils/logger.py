"""Centralized logging configuration for backend services.

Provides a unified logging interface that works across:
- Lambda environments (CloudWatch Logs with structured JSON via Powertools)
- Local development (console + optional Logfire)

Usage:
    from backend.core.utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Message", extra_key="value")

    # In Lambda handlers, use the decorator:
    @logger.inject_lambda_context(log_event=True)
    def lambda_handler(event, context):
        logger.info("Processing", job_id=job_id)
"""

import logging
import os
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aws_lambda_powertools import Logger

# Module-level logger instance for Lambda environments
_powertools_logger: "Logger | None" = None  # pylint: disable=invalid-name


def get_logger(name: str | None = None) -> "Logger | logging.Logger":
    """Get a configured logger instance.

    In Lambda environments, returns an AWS Lambda Powertools Logger
    with structured JSON output and automatic correlation ID injection.

    In local development, returns a standard Python logger.

    Args:
        name: Logger name, typically __name__ of the calling module.
              If None, returns the root/service logger.

    Returns:
        Configured logger instance.
    """
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return _get_powertools_logger(name)
    return _get_local_logger(name)


def _get_powertools_logger(name: str | None = None) -> "Logger":
    """Get AWS Lambda Powertools logger for Lambda environments."""
    global _powertools_logger  # pylint: disable=global-statement

    if _powertools_logger is None:
        # pylint: disable-next=import-outside-toplevel
        from aws_lambda_powertools import Logger

        service_name = os.environ.get("POWERTOOLS_SERVICE_NAME", "survey-analysis")
        log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

        _powertools_logger = Logger(
            service=service_name,
            level=log_level,
            # Include function context automatically
            log_uncaught_exceptions=True,
        )

    # For child loggers, return the same instance but with module context
    if name:
        _powertools_logger.append_keys(module=name)

    return _powertools_logger


def _get_local_logger(name: str | None = None) -> logging.Logger:
    """Get standard Python logger for local development."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Configure root logger once
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=log_level,
            format=log_format,
            handlers=[logging.StreamHandler(sys.stdout)],
        )

    return logging.getLogger(name)


def configure_logfire():
    """Configure Logfire with project-specific settings.

    Skips logfire configuration in the Lambda environment - uses CloudWatch Logs only.
    """
    # Skip logfire in Lambda - use CloudWatch Logs only
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return

    try:
        import logfire  # pylint: disable=import-outside-toplevel

        # Get the root directory (two levels up from utils/)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(current_dir))
        logfire_dir = os.path.join(root_dir, ".logfire")

        # Configure Logfire
        logfire.configure(data_dir=logfire_dir, scrubbing=False)
        logfire.instrument_pydantic_ai()
    except ImportError:
        # Logfire not installed, skip
        pass
