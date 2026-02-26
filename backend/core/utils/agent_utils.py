"""Common utilities for agent operations."""

import random
import string

_ID_CHARS = string.ascii_letters + string.digits  # [a-zA-Z0-9]


def generate_random_id(length: int = 7) -> str:
    """Generate a random alphanumeric ID.

    Args:
        length: Number of characters in the ID. Defaults to 7.

    Returns:
        Random alphanumeric string of specified length.
    """
    return "".join(random.choices(_ID_CHARS, k=length))
