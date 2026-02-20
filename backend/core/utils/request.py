"""Lambda request parsing utilities for different event sources."""

import json
from typing import Any
from urllib.parse import unquote_plus

# =============================================================================
# API Gateway Request Parsing
# =============================================================================


def parse_api_gateway_body(event: dict[str, Any]) -> dict[str, Any]:
    """Parse and validate API Gateway request body.

    Args:
        event: API Gateway event dict

    Returns:
        Parsed JSON body as dict

    Raises:
        ValueError: If body is missing or invalid JSON
    """
    body = event.get("body")
    if not body:
        raise ValueError("Missing request body")

    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in request body: {e}") from e


def extract_path_parameter(
    event: dict[str, Any], param_name: str, required: bool = True
) -> str | None:
    """Extract a path parameter from API Gateway event.

    Args:
        event: API Gateway event dict
        param_name: Name of the path parameter to extract
        required: If True, raises KeyError when parameter is missing

    Returns:
        The path parameter value, or None if not found and not required

    Raises:
        KeyError: If parameter is missing and required=True
    """
    path_params = event.get("pathParameters") or {}
    value = path_params.get(param_name)

    if required and not value:
        raise KeyError(f"Missing required path parameter: {param_name}")

    return value


def extract_header(
    event: dict[str, Any], header_name: str, default: str | None = None
) -> str | None:
    """Extract a header from API Gateway event (case-insensitive).

    API Gateway may lowercase headers, so this checks both cases.

    Args:
        event: API Gateway event dict
        header_name: Name of the header to extract (e.g., 'X-Idempotency-Key')
        default: Default value if header not found

    Returns:
        The header value, or default if not found
    """
    headers = event.get("headers") or {}

    # Try exact case first, then lowercase
    value = headers.get(header_name) or headers.get(header_name.lower())

    return value if value else default


def is_options_request(event: dict[str, Any]) -> bool:
    """Check if event is a CORS preflight OPTIONS request.

    Args:
        event: API Gateway event dict

    Returns:
        True if this is an OPTIONS request
    """
    return event.get("httpMethod") == "OPTIONS"


# =============================================================================
# SQS Message Parsing
# =============================================================================


def parse_sqs_message(record: dict[str, Any]) -> dict[str, Any]:
    """Parse SQS message body.

    Args:
        record: SQS record from event['Records']

    Returns:
        Parsed message body as dict

    Raises:
        ValueError: If body is missing or invalid JSON
    """
    body = record.get("body")
    if not body:
        raise ValueError("Missing SQS message body")

    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in SQS message: {e}") from e


def parse_sqs_event(
    event: dict[str, Any], required_fields: list[str] | None = None
) -> dict[str, Any]:
    """Parse SQS event and extract message body with validation.

    Handles the common pattern of SQS-triggered lambdas that expect
    a single message per invocation.

    Args:
        event: SQS event containing Records
        required_fields: Optional list of required fields to validate

    Returns:
        Parsed message body as dict

    Raises:
        ValueError: If event structure is invalid or JSON parsing fails
        KeyError: If required fields are missing
    """
    if "Records" not in event or len(event["Records"]) == 0:
        raise ValueError("No SQS records in event")

    record = event["Records"][0]
    body = parse_sqs_message(record)

    if required_fields:
        validate_required_fields(body, required_fields)

    return body


# =============================================================================
# S3 Event Parsing
# =============================================================================


def parse_s3_event(record: dict[str, Any], url_decode: bool = True) -> dict[str, Any]:
    """Extract S3 event details from record.

    Args:
        record: S3 record from event['Records']
        url_decode: Whether to URL-decode the S3 key (default True)

    Returns:
        Dict with 's3_bucket', 's3_key', 's3_size', 'event_name'

    Raises:
        KeyError: If required S3 fields are missing
    """
    s3_info = record["s3"]
    key = s3_info["object"]["key"]

    if url_decode:
        key = unquote_plus(key)

    return {
        "s3_bucket": s3_info["bucket"]["name"],
        "s3_key": key,
        "s3_size": s3_info["object"].get("size", 0),
        "event_name": record.get("eventName", "Unknown"),
    }


# =============================================================================
# Async Lambda Event Parsing
# =============================================================================


def parse_async_lambda_event(
    event: dict[str, Any], required_fields: list[str] | None = None
) -> dict[str, Any]:
    """Parse event from async Lambda invocation.

    Use this for lambdas invoked asynchronously (InvocationType='Event')
    by other lambdas, where the event is a simple dict payload.

    Args:
        event: Lambda event dict (direct payload, not wrapped)
        required_fields: Optional list of required fields to validate

    Returns:
        The event dict (possibly validated)

    Raises:
        KeyError: If required fields are missing
    """
    if required_fields:
        validate_required_fields(event, required_fields)

    return event


# =============================================================================
# Validation Utilities
# =============================================================================


def validate_required_fields(data: dict[str, Any], fields: list[str]) -> None:
    """Validate that all required fields exist and are non-empty in data.

    Args:
        data: Dict to validate
        fields: List of required field names

    Raises:
        KeyError: If any field is missing or empty
    """
    for field in fields:
        value = data.get(field)
        if value is None:
            raise KeyError(f"Missing required field: {field}")
        if isinstance(value, str) and not value.strip():
            raise KeyError(f"{field} must be a non-empty string")


def validate_numeric_range(
    data: dict[str, Any], start_field: str, end_field: str
) -> None:
    """Validate that start_field < end_field in data.

    Args:
        data: Dict containing the fields
        start_field: Name of the start field
        end_field: Name of the end field

    Raises:
        ValueError: If start >= end
    """
    start = data.get(start_field)
    end = data.get(end_field)

    if start is not None and end is not None and start >= end:
        raise ValueError(
            f"Invalid range: {start_field} ({start}) must be less than {end_field} ({end})"
        )
