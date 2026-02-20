"""Lambda response utilities for consistent response formatting."""

import json
from typing import Any

# Base CORS headers for simple responses (S3-triggered lambdas, etc.)
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

# Extended CORS headers for API Gateway endpoints
API_CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Idempotency-Key,X-Request-Id",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
}


def _build_headers(
    include_cors: bool = False,
    use_api_cors: bool = False,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, str] | None:
    """Build response headers.

    Args:
        include_cors: Whether to include CORS headers
        use_api_cors: Use extended API CORS headers (includes X-Request-Id, etc.)
        extra_headers: Additional headers to merge

    Returns:
        Headers dict or None if no headers needed
    """
    if not include_cors and not extra_headers:
        return None

    headers: dict[str, str] = {}
    if include_cors:
        base_headers = API_CORS_HEADERS if use_api_cors else CORS_HEADERS
        headers.update(base_headers)
    if extra_headers:
        headers.update(extra_headers)

    return headers if headers else None


def success_response(
    body: dict[str, Any],
    status_code: int = 200,
    include_cors: bool = False,
    use_api_cors: bool = False,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build a success response dict for Lambda.

    Args:
        body: Response body to serialize as JSON
        status_code: HTTP status code (default 200)
        include_cors: Whether to include CORS headers
        use_api_cors: Use extended API CORS headers (includes X-Request-Id, etc.)
        extra_headers: Additional headers to include (e.g., Location, Retry-After)

    Returns:
        Lambda response dict with statusCode, body, and optional headers
    """
    response: dict[str, Any] = {"statusCode": status_code, "body": json.dumps(body)}

    headers = _build_headers(include_cors, use_api_cors, extra_headers)
    if headers:
        response["headers"] = headers

    return response


def error_response(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    error: str,
    status_code: int = 500,
    error_type: str | None = None,
    details: str | None = None,
    include_cors: bool = False,
    use_api_cors: bool = False,
    extra_headers: dict[str, str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build an error response dict for Lambda.

    Args:
        error: Error message
        status_code: HTTP status code (default 500)
        error_type: Error type/category (e.g., 'ValidationError')
        details: Additional error details
        include_cors: Whether to include CORS headers
        use_api_cors: Use extended API CORS headers (includes X-Request-Id, etc.)
        extra_headers: Additional headers to include (e.g., X-Request-Id)
        metadata: Additional metadata to include in response body

    Returns:
        Lambda response dict with statusCode, body, and optional headers
    """
    body: dict[str, Any] = {"error": error}
    if error_type:
        body["type"] = error_type
    if details:
        body["details"] = details
    if metadata:
        body["metadata"] = metadata

    response: dict[str, Any] = {"statusCode": status_code, "body": json.dumps(body)}

    headers = _build_headers(include_cors, use_api_cors, extra_headers)
    if headers:
        response["headers"] = headers

    return response


def options_response(use_api_cors: bool = False) -> dict[str, Any]:
    """Build a CORS preflight response for OPTIONS requests.

    Args:
        use_api_cors: Use extended API CORS headers (default False)

    Returns:
        Lambda response dict with 200 status and CORS headers
    """
    return {
        "statusCode": 200,
        "headers": API_CORS_HEADERS if use_api_cors else CORS_HEADERS,
        "body": "",
    }


def async_response(body: dict[str, Any], include_cors: bool = False) -> dict[str, Any]:
    """Build a response for async Lambda invocations (non-API Gateway).

    Use this for lambdas invoked asynchronously (InvocationType='Event')
    where the response is primarily for logging/monitoring purposes.

    Args:
        body: Response body to serialize as JSON
        include_cors: Whether to include CORS headers (usually False for async)

    Returns:
        Lambda response dict with statusCode and body
    """
    response: dict[str, Any] = {"statusCode": 200, "body": json.dumps(body)}
    if include_cors:
        response["headers"] = CORS_HEADERS
    return response


def async_error_response(error: str, status_code: int = 500) -> dict[str, Any]:
    """Build an error response for async Lambda invocations.

    Use this for lambdas invoked asynchronously where the response
    is primarily for logging/monitoring purposes.

    Args:
        error: Error message
        status_code: HTTP status code (default 500)

    Returns:
        Lambda response dict with statusCode and body
    """
    return {"statusCode": status_code, "body": json.dumps({"error": error})}
