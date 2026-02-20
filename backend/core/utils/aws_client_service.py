"""AWS client factory for creating boto3 clients with proper session configuration."""

import os

import boto3
from botocore.config import Config


def get_client(service_name, read_timeout=None):
    """Create a boto3 client for the specified service.

    In Lambda environments, credentials are automatically provided via IAM role.
    For local development, set AWS_PROFILE environment variable if needed.
    """
    profile_name = os.environ.get(
        "AWS_PROFILE"
    )  # Only use profile if explicitly set (for local development)
    region_name = os.environ.get("AWS_REGION")

    if profile_name:
        # Local development with profile
        session = boto3.Session(region_name=region_name, profile_name=profile_name)
    else:
        # Lambda or default credentials (IAM role)
        session = boto3.Session(region_name=region_name)

    config = None
    if read_timeout:
        config = Config(read_timeout=read_timeout)

    return session.client(service_name, config=config)
