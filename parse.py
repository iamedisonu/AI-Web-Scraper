"""AI parsing: ask a local Ollama model about the scraped content.

Requires Ollama to be installed and running locally
(https://ollama.com) with the model pulled, e.g. `ollama pull llama3.1`.
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import OllamaLLM

TEMPLATE = (
    "You are tasked with extracting specific information from the following text content: {dom_content}. "
    "Please follow these instructions carefully:\n\n"
    "1. **Extract Information:** Only extract the information that directly matches the provided description: {parse_description}.\n"
    "2. **No Extra Content:** Do not include any additional text, comments, or explanations in your response.\n"
    "3. **Empty Response:** If no information matches the description, return an empty string ('').\n"
    "4. **Direct Data Only:** Your output should contain only the data that is explicitly requested, with no other text."
)

MODEL = "llama3.1"


def parse_with_ollama(dom_chunks, parse_description):
    """Run every chunk through the model and join what comes back.

    Raises a plain-language RuntimeError when Ollama is not reachable,
    instead of dumping a connection traceback on the user.
    """
    llm = OllamaLLM(model=MODEL)
    prompt = ChatPromptTemplate.from_template(TEMPLATE)
    chain = prompt | llm

    parsed_results = []
    for i, chunk in enumerate(dom_chunks, start=1):
        print(f"Parsing chunk {i} of {len(dom_chunks)}...")
        try:
            response = chain.invoke(
                {"dom_content": chunk, "parse_description": parse_description}
            )
        except Exception as exc:
            raise RuntimeError(
                "Could not reach Ollama. Make sure Ollama is installed and "
                f"running, and that the '{MODEL}' model is pulled "
                f"(`ollama pull {MODEL}`)."
            ) from exc
        if response and response.strip():
            parsed_results.append(response.strip())

    return "\n".join(parsed_results)
