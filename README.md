# 🕷️ AI Web Scraper

A web scraper that turns messy web pages into clean, readable text — and, with the local version, uses an AI model to extract *exactly* the information you ask for from a page.

**▶️ Live demo (browser version): https://iamedisonu.github.io/AI-Web-Scraper/**

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Selenium](https://img.shields.io/badge/Selenium-4-green)
![Streamlit](https://img.shields.io/badge/UI-Streamlit-red)
![Ollama](https://img.shields.io/badge/AI-Ollama%20%2F%20llama3.1-black)

## Two ways to use it

| | Browser version (GitHub Pages) | Local version (Streamlit) |
|---|---|---|
| **Runs** | 100% in your browser, nothing to install | On your machine with Python |
| **Fetching** | Browser fetch (direct, or via a public CORS proxy) | Selenium driving a real Edge browser — handles JavaScript-heavy pages |
| **Cleaning** | DOMParser in JavaScript | BeautifulSoup |
| **Extraction** | Keyword filter over the page's paragraphs | A local Ollama model (llama3.1) — describe what you want in plain words |
| **Privacy** | Page content stays in your browser (unless the proxy route is used) | Everything stays on your machine |
| **Best for** | Quick look at a page's text, headings and links | Scraping real, dynamic sites and AI-powered extraction |

## Browser version

Open the **[live demo](https://iamedisonu.github.io/AI-Web-Scraper/)**, paste a URL, and hit **Scrape site**. You get:

- Page title, meta description, and stats (words, headings, links, images)
- **Cleaned text** — scripts, styles and clutter stripped out
- **Headings** — the page's outline
- **Links** — every unique link on the page
- **Extract** — paragraphs that mention your keywords, highlighted
- Downloads of the result as `.txt`, `.md`, or `.json`

If a site blocks browser fetching, the page also lets you **paste the page's HTML** and parses it entirely on your device. The interface is plain HTML/CSS/JavaScript (`index.html`, `style.css`, `app.js`) with no build step — GitHub Pages serves it straight from this repo.

## Run the full version locally (Selenium + Ollama AI)

### 1. Prerequisites

- Python 3.10+
- Microsoft Edge installed (Selenium Manager downloads the matching driver automatically — no driver file needed in the repo)
- For AI parsing only: [Ollama](https://ollama.com) installed and running, with the model pulled:

```bash
ollama pull llama3.1
```

### 2. Install and run

```bash
git clone https://github.com/iamedisonu/AI-Web-Scraper.git
cd AI-Web-Scraper
python -m venv .venv
# Windows:        .venv\Scripts\activate
# macOS / Linux:  source .venv/bin/activate
pip install -r requirements.txt
streamlit run aiweb.py
```

### 3. Use it

1. Enter a URL and click **Scrape Site** — the cleaned page content appears on the page (and can be downloaded as a `.txt` file).
2. Describe what you want in plain words — e.g. *"all the product names and their prices"* — and click **Parse Content**. The content is split into chunks and each chunk is sent to the local llama3.1 model; only the matching information comes back.

## How it works

```
aiweb.py    Streamlit UI: URL input, results, downloads, parse box
   │
scrape.py   Selenium (headless Edge) loads the page and waits for it to
   │        finish, BeautifulSoup strips scripts/styles and produces
   │        clean text, split into LLM-sized chunks
   │
parse.py    LangChain + Ollama (llama3.1): each chunk is checked against
            your description; matching data is returned, nothing else
```

## Project structure

```
.
├── index.html        # Browser interface (GitHub Pages)
├── style.css         # Interface styling
├── app.js            # Fetching, parsing, extraction, downloads
├── aiweb.py          # Streamlit app (local version)
├── scrape.py         # Selenium scraping + HTML cleaning helpers
├── parse.py          # Ollama / LangChain extraction
├── requirements.txt  # Python dependencies
└── README.md
```

## Bugs fixed in the cleanup

The original upload worked as a first prototype but had real problems, all fixed now:

- The Streamlit app **never showed the scrape result** — it only `print()`ed it to the terminal. Results now render in the page, persist in session state, and can be downloaded.
- `scrape.py` read `driver.page_source` **before** its 10-second sleep, so it often returned a half-loaded page. It now waits for `document.readyState == "complete"` before reading the source, and runs headless.
- The driver was a **hardcoded `./msedgedriver.exe`** (Windows-only, version-fragile). Selenium Manager now resolves the right driver automatically on any OS.
- There was **no URL validation** — empty or malformed input crashed the app. URLs are now normalized (bare domains get `https://`) and rejected with a clear message.
- The **AI half of the project didn't exist**: `langchain` and `langchain_ollama` were in `requirements.txt` but never used. `parse.py` now implements the Ollama extraction, with a plain-language error if Ollama isn't running.
- A **whole Python virtual environment (the `ai/` folder), `__pycache__` folders and the 17 MB driver binary were committed** to the repo. They've been removed and a proper `.gitignore` added. (They still exist in the old git history — the repo's working tree is clean.)
- No README, no description of how anything worked. You're reading the fix.

## Troubleshooting

- **`Scraping failed: ...`** — check the URL opens in your browser. Some sites block automated browsers; the local version handles far more sites than the browser version, but not sites with login walls or CAPTCHAs.
- **`Could not reach Ollama`** — start Ollama and run `ollama pull llama3.1` once.
- **Browser version can't fetch a page** — use the *paste HTML* option on the page, or the local version.

## A note on scraping politely

Only scrape pages you are allowed to, respect each site's terms of service and `robots.txt`, and don't fire off rapid-fire requests. This project is for learning and personal use.

## Author

**Edison Uwamungu** — [github.com/iamedisonu](https://github.com/iamedisonu)
