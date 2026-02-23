"""Survey analysis agent for processing survey data with semantic search."""

import os

import pandas as pd
from botocore.client import BaseClient
from pydantic_ai import Agent
from pydantic_ai.models.bedrock import BedrockConverseModel
from pydantic_ai.providers.bedrock import BedrockProvider

from backend.core.agents.tools.semantic_search_tool import register_semantic_search_tool
from backend.core.deps.agent_deps import AnalystAgentDeps
from backend.core.models.analysis_output import AnalysisOutput
from backend.core.prompts.agent_prompt import AGENT_INSTRUCTIONS
from backend.core.services.citation_resolver import resolve_citations
from backend.core.services.embeddings_service import EmbeddingStore
from backend.core.utils.aws_client_service import get_client
from backend.core.utils.logger import configure_logfire


def setup_bedrock_model(bedrock_client, model_name):
    """Create a Bedrock model instance with the given client and model name."""
    bedrock_provider = BedrockProvider(bedrock_client=bedrock_client)
    return BedrockConverseModel(model_name=model_name, provider=bedrock_provider)


def register_tools(
    agent: Agent[None, str], bedrock_client: BaseClient, model_name: str
):
    """Register all tools with the agent."""
    register_semantic_search_tool(agent, bedrock_client, model_name)


def init_agent():
    """
    Initialize the survey agent with all dependencies.

    Returns:
        tuple: (agent, embedding_store) ready for querying
    """
    configure_logfire()

    bedrock_client = get_client("bedrock-runtime", read_timeout=600)
    model_name = os.environ.get(
        "BEDROCK_MODEL_NAME", "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    )

    embedding_store = EmbeddingStore(bedrock_client=bedrock_client)
    bedrock_model = setup_bedrock_model(bedrock_client, model_name)
    agent = Agent(
        model=bedrock_model,
        output_type=AnalysisOutput,
        deps_type=AnalystAgentDeps,
        system_prompt=AGENT_INSTRUCTIONS,
    )

    register_tools(agent, bedrock_client, model_name)

    return agent, embedding_store


def run_query(agent: Agent[None, str], query: str, deps: AnalystAgentDeps):
    """
    Run a query against the survey agent.

    Args:
        agent: The initialized agent instance
        embedding_store: The embedding store instance
        query: The user query to process

    Returns:
        AnalysisOutput: The agent's structured response
    """
    result = agent.run_sync(user_prompt=query, deps=deps)
    return result.output


def run_query_with_citations(agent: Agent[None, str], embedding_store, query):
    """
    Run a query against the survey agent and return results with citations.

    Args:
        agent: The initialized agent instance
        embedding_store: The embedding store instance
        query: The user query to process

    Returns:
        dict: Contains 'response', 'cited_responses', 'cited_count', and 'search_results'
    """
    deps = AnalystAgentDeps(embedding_store=embedding_store)
    output: AnalysisOutput = run_query(agent=agent, query=query, deps=deps)

    # Combine all search results into single DataFrame
    if deps.search_results:
        combined_df = pd.concat(deps.search_results, ignore_index=True)
    else:
        combined_df = pd.DataFrame()

    # Resolve citations using id lookup
    cited_responses = resolve_citations(output, combined_df)

    # Build id -> excerpt mapping for markdown formatting
    id_to_excerpt = {}
    for c in cited_responses:
        if combined_df is not None and not combined_df.empty:
            match = combined_df[combined_df["response_id"] == c["response_id"]]
            if not match.empty:
                id_to_excerpt[match.iloc[0]["id"]] = c["excerpt"]

    enriched_response = _build_enriched_response(output, id_to_excerpt)

    return {
        "response": enriched_response,
        "cited_responses": cited_responses,
        "cited_count": len(cited_responses),
        "search_results": (
            combined_df.to_dict(orient="records") if not combined_df.empty else []
        ),
    }


def _build_enriched_response(output: AnalysisOutput, id_to_excerpt: dict) -> dict:
    """Build enriched JSON response with citations resolved to excerpts."""
    return {
        "summary": output.summary,
        "themes": [
            {
                "name": theme.name,
                "summary": theme.summary,
                "supporting_citations": [
                    {"excerpt": id_to_excerpt.get(c, "")}
                    for c in theme.supporting_citations
                    if id_to_excerpt.get(c)
                ],
            }
            for theme in output.themes
        ],
    }
