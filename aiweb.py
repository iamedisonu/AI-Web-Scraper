import streamlit as st

from parse import parse_with_ollama
from scrape import (
    clean_body_content,
    extract_body_content,
    scrape_website,
    split_dom_content,
)

st.set_page_config(page_title="AI Web Scraper", page_icon="🕷️")
st.title("AI Web Scraper")
st.write(
    "Enter a URL to scrape a website with Selenium, then optionally ask a "
    "local Ollama model (llama3.1) to pull out just the information you want."
)

url = st.text_input("Enter a website URL:", placeholder="https://example.com")

if st.button("Scrape Site"):
    if not url.strip():
        st.warning("Please enter a URL first.")
    else:
        try:
            with st.spinner("Scraping the website..."):
                html = scrape_website(url)
                body_content = extract_body_content(html)
                dom_content = clean_body_content(body_content)
            st.session_state["dom_content"] = dom_content
            st.success("Scraping done. The cleaned content is below.")
        except Exception as exc:
            st.session_state.pop("dom_content", None)
            st.error(f"Scraping failed: {exc}")

# The old version only printed the result to the terminal, so the page
# itself never showed anything. The scraped content lives in the
# session state now and is displayed (and downloadable) here.
if "dom_content" in st.session_state:
    dom_content = st.session_state["dom_content"]

    with st.expander("View scraped content", expanded=True):
        st.text_area("Cleaned page content", dom_content, height=300)

    st.download_button(
        "Download scraped content (.txt)",
        data=dom_content,
        file_name="scraped_content.txt",
        mime="text/plain",
    )

    st.divider()
    st.subheader("Parse with AI")
    parse_description = st.text_area(
        "Describe what you want to extract from the page:",
        placeholder="e.g. All the product names and their prices",
    )

    if st.button("Parse Content"):
        if not parse_description.strip():
            st.warning("Describe what to extract first.")
        else:
            try:
                with st.spinner("Parsing with Ollama (llama3.1)..."):
                    chunks = split_dom_content(dom_content)
                    parsed = parse_with_ollama(chunks, parse_description)
                if parsed:
                    st.session_state["parsed_result"] = parsed
                else:
                    st.session_state.pop("parsed_result", None)
                    st.info("The model found nothing on the page matching that description.")
            except Exception as exc:
                st.error(str(exc))

if "parsed_result" in st.session_state:
    st.subheader("Parsed result")
    st.text_area("Result", st.session_state["parsed_result"], height=250)
    st.download_button(
        "Download parsed result (.txt)",
        data=st.session_state["parsed_result"],
        file_name="parsed_result.txt",
        mime="text/plain",
    )
