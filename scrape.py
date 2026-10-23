"""Scraping helpers for the AI Web Scraper.

Fetches a page with Selenium (Microsoft Edge, driven automatically by
Selenium Manager -- no driver .exe needs to live in this repo) and turns
the raw HTML into clean text that can be handed to an LLM.
"""

from urllib.parse import urlparse

# Selenium and BeautifulSoup are imported inside the functions that use
# them, so the URL/text helpers below can be imported (and tested)
# without a browser or the scraping dependencies installed.


def normalize_url(url):
    """Return a usable URL or raise ValueError with a clear message."""
    if not url or not url.strip():
        raise ValueError("Please enter a website URL.")
    url = url.strip()
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"'{url}' does not look like a valid website URL.")
    return url


def scrape_website(website, wait_seconds=15):
    """Load a page in headless Edge and return its HTML source.

    Waits until the page body exists and the document is fully loaded
    *before* reading the source (the old version read the source first
    and slept afterwards, so it often returned a half-loaded page).
    """
    import selenium.webdriver as webdriver
    from selenium.webdriver.support.ui import WebDriverWait

    url = normalize_url(website)
    print("Launching Edge browser...")

    options = webdriver.EdgeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    # No Service(...) path: Selenium Manager finds/downloads the right
    # driver for the installed browser, on any OS.
    driver = webdriver.Edge(options=options)
    driver.set_page_load_timeout(wait_seconds * 2)
    try:
        driver.get(url)
        WebDriverWait(driver, wait_seconds).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        print("Page loaded.")
        return driver.page_source
    finally:
        driver.quit()


def extract_body_content(html_content):
    """Return just the <body> HTML, without scripts and styles."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_content, "lxml")
    body = soup.body
    if body is None:
        return ""
    for tag in body(["script", "style", "noscript"]):
        tag.extract()
    return str(body)


def clean_text(text):
    """Collapse raw extracted text into non-empty, trimmed lines."""
    lines = (line.strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line)


def clean_body_content(body_content):
    """Turn body HTML into clean plain text, one element per line."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(body_content, "lxml")
    return clean_text(soup.get_text(separator="\n"))


def split_dom_content(dom_content, max_length=6000):
    """Split cleaned content into chunks an LLM context window can take."""
    chunks = []
    for start in range(0, max(len(dom_content), 1), max_length):
        chunk = dom_content[start : start + max_length]
        if chunk:
            chunks.append(chunk)
    return chunks or [""]
