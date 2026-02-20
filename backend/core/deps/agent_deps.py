"""Dependencies for the analyst agent."""

from dataclasses import dataclass, field

import pandas as pd
from pydantic_ai import ModelRetry

from backend.core.services.embeddings_service import EmbeddingStore


@dataclass
class AnalystAgentDeps:
    """Dependency container for the analyst agent."""

    output: dict[str, pd.DataFrame] = field(default_factory=dict)
    embedding_store: EmbeddingStore | None = None
    search_results: list[pd.DataFrame] = field(default_factory=list)

    def store(self, value: pd.DataFrame) -> str:
        """Store the output in deps.

        Returns the reference such as Out[1] to be used by the LLM.
        """
        ref = f"Out[{len(self.output) + 1}]"
        self.output[ref] = value
        return ref

    def get(self, ref: str) -> pd.DataFrame:
        """Retrieve a stored DataFrame by its reference."""
        if ref not in self.output:
            raise ModelRetry(
                f"Error: {ref} is not a valid variable reference. "
                "Check the previous messages and try again."
            )
        return self.output[ref]

    def store_search_result(self, df: pd.DataFrame) -> None:
        """Store search result DataFrame for later reference."""
        self.search_results.append(df.copy())
