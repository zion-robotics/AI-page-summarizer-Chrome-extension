# PageMind — AI Page Summarizer Chrome Extension

> Instantly summarize any webpage with AI. Get bullet points, key insights, and estimated reading time — all in one click.

![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)
![AI](https://img.shields.io/badge/AI-Claude%20(Anthropic)-blueviolet)
![Chrome](https://img.shields.io/badge/Chrome-Extension-green)

---

## Features

- **One-click summarization** of any article or webpage
- **Bullet-point summary** (3–5 key points)
- **Key insights** (2–3 deeper takeaways)
- **Reading time estimate** and word count
- **Content topic label**
- **Smart caching** — same URL won't re-call the API for 30 minutes
- **Dark/Light mode toggle**
- **Copy to clipboard** button
- **Heuristic content extraction** — ignores navbars, footers, ads

---

## Installation (Local / Developer Mode)

> This extension is not published to the Chrome Web Store. Follow these steps to install it locally.

### Step 1 — Download the extension

1. Click **Code → Download ZIP** on the GitHub repo page
2. Extract the ZIP to a permanent folder on your computer (e.g., `Documents/pagemind-extension`)
3. **Do not delete this folder** — Chrome loads the extension from it

### Step 2 — Add your API key

1. Open the file `background/config.js`
2. Replace `YOUR_API_KEY_HERE` with your Anthropic API key:
   ```js
   ANTHROPIC_API_KEY: "sk-ant-..."
   ```
3. Save the file

### Step 3 — Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder where you extracted the extension (the one containing `manifest.json`)
5. The PageMind icon will appear in your Chrome toolbar

### Step 4 — Pin the extension (optional but recommended)

1. Click the puzzle piece icon in the Chrome toolbar
2. Find **PageMind** and click the pin icon

---

## Usage

1. Navigate to any article, blog post, news page, or documentation
2. Click the **PageMind** icon in your Chrome toolbar
3. Click **Summarize Page**
4. Wait a few seconds — the extension will extract the content and call the AI
5. Read your structured summary!

---

## Architecture

```
extension/
├── manifest.json             # MV3 configuration
├── background/
│   ├── background.js         # Service worker — all AI API calls happen here
│   └── config.js             # API key (gitignored — never committed)
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic, state management, rendering
│   └── popup.css             # Styles (light/dark theme)
├── content/
│   └── content.js            # Injected into pages — extracts readable content
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .gitignore                # Ensures config.js (API key) is never committed
└── README.md
```

### Message Flow

```
[User clicks Summarize]
        ↓
[popup.js] → sendMessage("EXTRACT_CONTENT") → [content.js]
        ↓
[content.js] extracts readable text → returns to popup.js
        ↓
[popup.js] → sendMessage("SUMMARIZE", {content, url, title}) → [background.js]
        ↓
[background.js] → checks chrome.storage cache
        ↓ (if no cache)
[background.js] → calls Anthropic Claude API
        ↓
[background.js] → parses + validates JSON response
        ↓
[popup.js] → renders structured summary to user
```

---

## AI Integration

- **Provider:** Anthropic Claude (`claude-sonnet-4-20250514`)
- **Call location:** `background/background.js` only — never in popup or content scripts
- **Prompt strategy:** Asks Claude to return strict JSON with `summary`, `keyInsights`, `readingTime`, `wordCount`, and `topic` fields
- **Fallback:** If JSON parsing fails, displays raw response as a single bullet
- **Content limit:** Page content truncated to 8,000 characters before sending to avoid token overflow

---

## Security Decisions

| Decision | Reason |
|---|---|
| API key only in `background.js` | Content scripts and popup scripts are accessible via DevTools. Background service workers are not. |
| `config.js` is gitignored | Prevents accidental API key commits to version control |
| All AI calls in background worker | Single, controlled location for all external requests |
| `textContent` not `innerHTML` for AI output | Prevents XSS injection from AI-generated content |
| Message action validation in background | Rejects malformed messages before processing |
| Minimal permissions | Only `activeTab`, `storage`, `scripting` — no broad host access beyond what's needed |

---

## Caching Strategy

- Summaries are cached in `chrome.storage.local` keyed by URL (base64 encoded)
- Cache expires after **30 minutes**
- A "Cached" badge appears in the popup when a cached result is served
- Prevents duplicate API calls for the same page within the session

---

## Content Extraction

The content script uses a priority-based heuristic:

1. **Semantic selectors first:** `article`, `[role="main"]`, `main`, common CMS class names
2. **Density scoring fallback:** Scores all `div`/`section` elements by word count, paragraph count, and link density (many links = likely nav, avoid it)
3. **Body fallback:** Last resort — strips and uses full body text
4. **Noise removal:** `nav`, `header`, `footer`, `aside`, `.sidebar`, `.advertisement`, `script`, `style` elements are stripped before extraction

---

## Trade-offs

| Trade-off | Decision made |
|---|---|
| No proxy server (simpler setup) | API key lives in local `config.js` — acceptable for a local-only developer extension |
| No readability library (Readability.js) | Heuristic extraction is simpler to ship; covers ~90% of article pages |
| 30-minute cache (not persistent) | Balances freshness vs. API cost reduction |
| Claude-only AI | Best structured JSON output for this use case; easy to swap via `config.js` |

---

## Updating the API Key

If you need to update your API key later:

1. Edit `background/config.js`
2. Go to `chrome://extensions/`
3. Click the **reload** icon on the PageMind card
4. The extension will use the new key immediately

---

## Troubleshooting

**"Content script not ready. Reload the page and try again."**
→ Reload the tab (Cmd+R / Ctrl+R) and try again. This happens on tabs that were open before the extension was installed.

**"Not enough content found on this page."**
→ The page may be login-gated, a dashboard, or mostly image-based. Works best on article and text-heavy pages.

**"API error: 401"**
→ Your API key is invalid or missing. Check `background/config.js`.

**Extension icon not appearing**
→ Click the puzzle piece icon in Chrome toolbar and pin PageMind.
