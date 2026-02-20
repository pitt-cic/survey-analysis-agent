"""Model for rewritten search queries."""

from pydantic import BaseModel, Field


class RewrittenQueries(BaseModel):
    """Pydantic model for rewritten queries output."""

    queries: list[str] = Field(
        description="List of 10 diverse search queries", min_length=1, max_length=10
    )
