#!/usr/bin/env python3
"""Run the survey agent locally with interactive input."""

from backend.core.agents.survey_agent import init_agent, run_query_with_citations


def main():
    print("Initializing survey agent...")
    agent, embedding_store = init_agent()
    print("Agent ready.\n")

    while True:
        try:
            query = input("Enter your query (or 'quit' to exit): ").strip()
            if query.lower() in ("quit", "exit", "q"):
                print("Goodbye!")
                break
            if not query:
                continue

            print("\nProcessing...")
            result = run_query_with_citations(agent, embedding_store, query)

            print(f"\n--- Response ---\n{result['response']}")
            print(f"\n--- Cited: {result['cited_count']} responses ---\n")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
