"""Common utilities for agent operations."""

import random
import string


class AgentUtils:
    """Utility class for common agent operations."""

    _ID_CHARS = string.ascii_letters + string.digits  # [a-zA-Z0-9]

    @staticmethod
    def generate_random_id(length: int = 7) -> str:
        """Generate a random alphanumeric ID.

        Args:
            length: Number of characters in the ID. Defaults to 7.

        Returns:
            Random alphanumeric string of specified length.
        """
        return "".join(random.choices(AgentUtils._ID_CHARS, k=length))
