"""Semantic search tool for multi-query survey response retrieval."""

import json

import pandas as pd
from botocore.client import BaseClient
from pydantic_ai import RunContext, Agent
from pydantic_ai.models.bedrock import BedrockConverseModel
from pydantic_ai.providers.bedrock import BedrockProvider

from backend.core.deps.agent_deps import AnalystAgentDeps
from backend.core.models.rewrite_query import RewrittenQueries
from backend.core.prompts.query_rewrite_prompt import QUERY_REWRITE_SYSTEM_PROMPT
from backend.core.utils.agent_utils import AgentUtils
from backend.core.utils.logger import get_logger

logger = get_logger(__name__)


def format_results_with_ids(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """
    Add an id column and format for LLM consumption.

    Args:
        df: DataFrame with response_id, event_name, question, text_answer columns

    Returns:
        tuple: (DataFrame with id column, formatted string for LLM)
    """
    if df.empty:
        return df, ""

    df = df.copy()
    df["id"] = [AgentUtils.generate_random_id(5) for _ in range(len(df))]

    lines = ["id | Event | Question | Response\n"]
    for _, row in df.iterrows():
        lines.append(
            f"[{row['id']}] {row.get('event_name', 'N/A')} | "
            f"{row.get('question', 'N/A')} | "
            f"{row.get('text_answer', 'N/A')}"
        )

    return df, "\n".join(lines)


def _generate_search_queries(
    _ctx: RunContext[AnalystAgentDeps],
    original_query: str,
    client: BaseClient,
    model_name: str,
) -> RewrittenQueries:
    bedrock_provider = BedrockProvider(bedrock_client=client)
    model = BedrockConverseModel(model_name=model_name, provider=bedrock_provider)
    query_agent = Agent(
        model=model,
        output_type=RewrittenQueries,
        system_prompt=QUERY_REWRITE_SYSTEM_PROMPT,
    )

    user_prompt = f"""Original query: {original_query}"""

    try:
        response = query_agent.run_sync(user_prompt=user_prompt)
        rewritten_queries: RewrittenQueries = response.output
        return rewritten_queries

    except Exception as e:
        logger.warning("rewrite_query_for_search error: %s", e)
        raise RuntimeError(f"Failed to generate search queries: {e}") from e


def register_semantic_search_tool(
    agent: Agent[None, str], client: BaseClient, model_name: str
):
    """Register the multi-query semantic search tool with the agent."""

    @agent.tool
    def multi_query_search(  # pylint: disable=too-many-locals
        ctx: RunContext[AnalystAgentDeps],
        original_search_query: str,
        top_k_per_query: int = 100,
    ) -> str:
        """Use this tool to perform semantic search across multiple query variations simultaneously.
        Pass the exact string entered by the user as the original_search_query parameter.

        Args:
            ctx: Runtime context containing agent dependencies.
            original_search_query: Exact string entered by user
            top_k_per_query: Number of results to retrieve per query (default: 100).

        Returns:
            Formatted string of deduplicated matching survey responses.
        """
        try:
            search_queries: RewrittenQueries = _generate_search_queries(
                ctx, original_search_query, client, model_name
            )
            if not search_queries.queries:
                error_msg = (
                    "Error: queries_json must be a non-empty JSON array of strings."
                )
                logger.warning("multi_query_search response: %s", error_msg)
                return error_msg
        except (json.JSONDecodeError, TypeError):
            error_msg = (
                "Error: Invalid JSON in queries_json. "
                "Expected a JSON array of query strings."
            )
            logger.warning("multi_query_search response: %s", error_msg)
            return error_msg

        # Search with each query and collect results
        # Track seen uids across queries for S3 Vectors $nin exclusion
        seen_uids = []  # Use list for $nin filter
        all_dfs = []
        successful_queries = 0

        for query in search_queries.queries:
            if not isinstance(query, str) or not query.strip():
                continue
            try:
                # Execute search with $nin filter to exclude already-seen uids
                # S3 Vectors will exclude these at the API level, returning NEW results
                results_df = ctx.deps.embedding_store.search(
                    query=query,
                    top_k=top_k_per_query,
                    exclude_uids=seen_uids if seen_uids else None,
                )
                if not results_df.empty:
                    # All results are guaranteed to be new (not in seen_uids)
                    # Update tracking list with new uids
                    new_uids = results_df["uid"].tolist()
                    seen_uids.extend(new_uids)

                    all_dfs.append(results_df)
                    successful_queries += 1

                    # Log stats for monitoring
                    logger.info(
                        "Query %d: Retrieved %d new results (total unique: %d)",
                        successful_queries,
                        len(results_df),
                        len(seen_uids),
                    )
                else:
                    logger.info("Query returned no results (possibly all excluded)")
            except Exception:  # pylint: disable=broad-exception-caught
                logger.warning("Search failed for query '%s'", query)
                continue

        # Log summary after all queries
        logger.info(
            "Multi-query search complete: %d queries executed, %d unique responses found",
            successful_queries,
            len(seen_uids),
        )

        if not all_dfs:
            no_match_msg = "No matching responses found."
            logger.info("multi_query_search response: %s", no_match_msg)
            return no_match_msg

        # Concatenate all results (already guaranteed unique by S3 Vectors $nin filter)
        combined_df = pd.concat(all_dfs, ignore_index=True)

        # Sort by similarity score for ranking
        combined_df = combined_df.sort_values("similarity_score", ascending=False)
        # Filter by minimum similarity threshold
        combined_df = combined_df[combined_df["similarity_score"] >= 0.15]

        if combined_df.empty:
            threshold_msg = "No matching responses found with similarity >= 0.15."
            logger.info("multi_query_search response: %s", threshold_msg)
            return threshold_msg

        # Store DataFrame with an id column for citation resolution
        combined_df_with_ids, indexed_results = format_results_with_ids(combined_df)
        ctx.deps.store_search_result(combined_df_with_ids)

        total_unique = len(combined_df_with_ids)

        # Format output for agent
        header = (
            f"Found {total_unique} unique responses across "
            f"{successful_queries} queries:\n\n"
        )
        result = header + indexed_results
        logger.info(
            "multi_query_search response: %d unique responses across %d queries",
            total_unique,
            successful_queries,
        )
        return result
