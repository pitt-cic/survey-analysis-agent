"""Service for resolving citation IDs to full response data."""

import pandas as pd

from backend.core.models.analysis_output import AnalysisOutput


def resolve_citations(
    output: AnalysisOutput, search_results_df: pd.DataFrame
) -> list[dict]:
    """
    Resolve citation IDs to full response data.

    Args:
        output: Structured analysis output with citation IDs
        search_results_df: DataFrame with id column and response data

    Returns:
        List of cited response dicts with full metadata
    """
    if search_results_df.empty:
        return []

    cited = []
    for theme in output.themes:
        for citation_id in theme.supporting_citations:
            match = search_results_df[search_results_df["id"] == citation_id]
            if not match.empty:
                result = match.iloc[0]
                cited.append(
                    {
                        "response_id": result["response_id"],
                        "survey_id": result.get("csv_source", ""),
                        "game_name": result.get("event_name", ""),
                        "response_text": result.get("text_answer", ""),
                        "question": result.get("question", ""),
                        "similarity_score": result.get("similarity_score", 0.0),
                        "excerpt": result.get("text_answer", ""),
                        "theme": theme.name,
                    }
                )

    return cited
