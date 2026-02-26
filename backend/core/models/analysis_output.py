"""Structured output models for survey analysis agent."""

from pydantic import BaseModel, Field


class Theme(BaseModel):
    """A theme identified in the analysis."""

    name: str = Field(description="Short, descriptive label for the theme.")
    summary: str = Field(
        description="A concise summary of what respondents said about this theme."
    )
    supporting_citations: list[str] = Field(
        description="List of unique IDs referencing a specific row from "
        "`multi_query_search` result that support this theme."
    )


class AnalysisOutput(BaseModel):
    """Structured output from the survey analysis agent."""

    summary: str = Field(
        description="High-level summary of the overall survey analysis findings."
    )
    themes: list[Theme] = Field(
        description="List of distinct themes identified across survey responses."
    )
