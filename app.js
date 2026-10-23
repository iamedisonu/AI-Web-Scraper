"use strict";

/* ---------- Pure helpers (also exercised by the node test) ---------- */

function normalizeUrl(raw) {
  if (!raw || !raw.trim()) throw new Error("Please enter a website URL.");
  let url = raw.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = "https://" + url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("'" + raw.trim() + "' does not look like a valid website URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("'" + raw.trim() + "' does not look like a valid website URL.");
  }
  return parsed.href;
}

// Collapse raw page text into trimmed, non-empty lines.
function cleanLines(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractKeywords(query) {
  return (query || "")
    .split(/[,\n]/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1);
}

// Return the paragraphs that mention at least one keyword.
function filterParagraphs(paragraphs, keywords) {
  if (!keywords.length) return [];
  return paragraphs.filter((p) => {
    const lower = p.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  });
}

function buildMarkdown(data) {
  const lines = [];
  lines.push("# " + (data.title || "Scraped page"));
  lines.push("");
  lines.push("- Source: " + data.url);
  if (data.description) lines.push("- Description: " + data.description);
  lines.push(
    "- Stats: " +
      data.stats.words + " words · " +
      data.stats.headings + " headings · " +
      data.stats.links + " links · " +
      data.stats.images + " images"
  );
  if (data.headings.length) {
    lines.push("", "## Headings", "");
    for (const h of data.headings) {
      lines.push("#".repeat(h.level) + " " + h.text);
    }
  }
  if (data.links.length) {
    lines.push("", "## Links", "");
    for (const l of data.links) {
      lines.push("- [" + (l.text || l.href) + "](" + l.href + ")");
    }
  }
  lines.push("", "## Cleaned text", "", data.text || "");
  return lines.join("\n");
}

/* ---------- Browser-only code ---------- */

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const state = { data: null };

  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  ];

  function setStatus(msg, kind) {
    const el = $("status");
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  async function fetchPage(url) {
    // 1) Direct fetch — works for sites that allow CORS.
    try {
      const res = await fetch(url);
      if (res.ok) return { html: await res.text(), route: "fetched directly" };
    } catch { /* fall through to the proxy */ }
    // 2) Public CORS proxy.
    for (const make of PROXIES) {
      const res = await fetch(make(url));
      if (res.ok) return { html: await res.text(), route: "fetched via a CORS proxy" };
    }
    throw new Error(
      "The page could not be fetched from the browser (the site is likely blocking it). " +
      "Try the 'Paste the page HTML' option below, or use the local Selenium version."
    );
  }

  function parseHtml(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = (doc.title || "").trim();
    const descEl = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    const description = descEl ? (descEl.getAttribute("content") || "").trim() : "";

    const body = doc.body;
    if (!body) throw new Error("That HTML has no <body> to scrape.");

    const headings = [...body.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").replace(/\s+/g, " ").trim() }))
      .filter((h) => h.text);

    const seen = new Set();
    const links = [];
    for (const a of body.querySelectorAll("a[href]")) {
      let href;
      try { href = new URL(a.getAttribute("href"), baseUrl).href; } catch { continue; }
      if (!/^https?:/.test(href) || seen.has(href)) continue;
      seen.add(href);
      links.push({ href, text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) });
    }

    const images = body.querySelectorAll("img").length;

    // Remove junk, then read block-level text with line breaks.
    const clone = body.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,iframe,svg,form,button").forEach((n) => n.remove());
    let rawText = "";
    if (typeof clone.innerText === "string" && clone.innerText.trim()) {
      rawText = clone.innerText;
    } else {
      const blocks = clone.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,blockquote,pre,figcaption,div");
      rawText = blocks.length
        ? [...blocks].map((b) => b.textContent).join("\n")
        : (clone.textContent || "");
    }
    const text = cleanLines(rawText);

    const paragraphs = [...clone.querySelectorAll("p, li, blockquote")]
      .map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 40);
    if (!paragraphs.length && text) {
      paragraphs.push(...text.split("\n").filter((l) => l.length > 40));
    }

    return {
      url: baseUrl,
      title,
      description,
      text,
      headings,
      links,
      paragraphs,
      stats: {
        words: text ? text.split(/\s+/).filter(Boolean).length : 0,
        headings: headings.length,
        links: links.length,
        images,
      },
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function highlight(text, keywords) {
    let out = escapeHtml(text);
    for (const k of keywords) {
      const re = new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }

  function render(data, route) {
    state.data = data;
    $("results").classList.remove("hidden");
    $("stats").innerHTML = [
      [data.stats.words.toLocaleString(), "Words"],
      [data.stats.headings, "Headings"],
      [data.stats.links, "Links"],
      [data.stats.images, "Images"],
    ].map(([n, name]) => '<div class="stat"><div class="num">' + n + '</div><div class="name">' + name + "</div></div>").join("");

    $("pageTitle").textContent = data.title || "(no page title)";
    $("pageDesc").textContent = data.description || "";
    const urlEl = $("pageUrl");
    urlEl.textContent = data.url;
    urlEl.href = data.url;
    $("fetchRoute").textContent = route || "";
    $("cleanText").textContent = data.text || "(no readable text found on this page)";

    $("headingList").innerHTML = data.headings.length
      ? data.headings.map((h) => '<li class="ind-' + h.level + '"><span class="lvl">H' + h.level + "</span>" + escapeHtml(h.text) + "</li>").join("")
      : "<li>No headings found.</li>";

    $("linkList").innerHTML = data.links.length
      ? data.links.slice(0, 300).map((l) =>
          '<li><a href="' + escapeHtml(l.href) + '" target="_blank" rel="noopener">' + escapeHtml(l.href) + "</a>" +
          (l.text ? '<span class="lt">' + escapeHtml(l.text) + "</span>" : "") + "</li>").join("")
      : "<li>No links found.</li>";

    $("extractResults").innerHTML = "";
    $("extractCount").textContent = "";
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function scrape() {
    const btn = $("scrapeBtn");
    let url;
    try {
      url = normalizeUrl($("urlInput").value);
    } catch (e) {
      setStatus(e.message, "error");
      return;
    }
    btn.disabled = true;
    setStatus("Scraping " + url + " …");
    try {
      const { html, route } = await fetchPage(url);
      const data = parseHtml(html, url);
      render(data, route);
      setStatus("Done — " + data.stats.words.toLocaleString() + " words of clean text.", "ok");
    } catch (e) {
      setStatus(e.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  $("scrapeBtn").addEventListener("click", scrape);
  $("urlInput").addEventListener("keydown", (e) => { if (e.key === "Enter") scrape(); });
  document.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => { $("urlInput").value = chip.dataset.url; scrape(); })
  );

  $("parseHtmlBtn").addEventListener("click", () => {
    const html = $("htmlInput").value;
    if (!html.trim()) { setStatus("Paste some HTML first.", "error"); return; }
    let base = "https://example.com/";
    try { base = normalizeUrl($("pasteUrl").value); } catch { /* keep default */ }
    try {
      const data = parseHtml(html, base);
      render(data, "parsed from pasted HTML");
      setStatus("Done — parsed the pasted HTML on your device.", "ok");
    } catch (e) {
      setStatus(e.message, "error");
    }
  });

  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".tab-panel").forEach((p) =>
        p.classList.toggle("hidden", p.dataset.panel !== tab.dataset.tab));
    })
  );

  document.querySelectorAll("[data-download]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!state.data) return;
      const kind = btn.dataset.download;
      const host = (() => { try { return new URL(state.data.url).hostname; } catch { return "page"; } })();
      if (kind === "txt") download(host + "-scraped.txt", state.data.text, "text/plain");
      if (kind === "md") download(host + "-scraped.md", buildMarkdown(state.data), "text/markdown");
      if (kind === "json") {
        const { paragraphs, ...rest } = state.data;
        download(host + "-scraped.json", JSON.stringify(rest, null, 2), "application/json");
      }
    })
  );

  $("copyBtn").addEventListener("click", async () => {
    if (!state.data) return;
    try {
      await navigator.clipboard.writeText(state.data.text);
      $("copyBtn").textContent = "Copied ✓";
      setTimeout(() => ($("copyBtn").textContent = "Copy text"), 1500);
    } catch {
      setStatus("Copy failed — select the text and copy it manually.", "error");
    }
  });

  function extract() {
    if (!state.data) return;
    const keywords = extractKeywords($("extractInput").value);
    if (!keywords.length) {
      $("extractCount").textContent = "Type at least one keyword first.";
      return;
    }
    const hits = filterParagraphs(state.data.paragraphs, keywords);
    $("extractCount").textContent =
      hits.length + " paragraph" + (hits.length === 1 ? "" : "s") +
      " mention" + (hits.length === 1 ? "s" : "") + ": " + keywords.join(", ");
    $("extractResults").innerHTML = hits.length
      ? hits.map((p) => "<p>" + highlight(p, keywords) + "</p>").join("")
      : "<p>No paragraph on this page mentions those keywords.</p>";
  }
  $("extractBtn").addEventListener("click", extract);
  $("extractInput").addEventListener("keydown", (e) => { if (e.key === "Enter") extract(); });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeUrl, cleanLines, extractKeywords, filterParagraphs, buildMarkdown };
}
