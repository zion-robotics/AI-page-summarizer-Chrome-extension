// ============================================================
//  PageMind — Popup Script
//  Handles UI state, messaging, and rendering
// ============================================================

const $ = (id) => document.getElementById(id);

// State
let currentSummary = null;
let isLoading = false;

// Elements
const btnSummarize = $("btnSummarize");
const btnCopy = $("btnCopy");
const btnClear = $("btnClear");
const btnTheme = $("themeToggle");
const stateIdle = $("stateIdle");
const stateLoading = $("stateLoading");
const stateError = $("stateError");
const stateResult = $("stateResult");
const loadingText = $("loadingText");
const loadingFill = $("loadingFill");
const errorMsg = $("errorMsg");
const pageTitle = $("pageTitle");
const pageUrl = $("pageUrl");
const pageFavicon = $("pageFavicon");

// ============================================================
//  Init
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  await loadPageInfo();
  await checkCachedSummary();

  btnSummarize.addEventListener("click", handleSummarize);
  btnClear.addEventListener("click", handleClear);
  btnCopy.addEventListener("click", handleCopy);
  btnTheme.addEventListener("click", toggleTheme);
});

// ============================================================
//  Page Info
// ============================================================

async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    pageTitle.textContent = tab.title || "Untitled Page";
    pageUrl.textContent = new URL(tab.url).hostname;

    // Set favicon
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${tab.url}`;
    const img = document.createElement("img");
    img.src = faviconUrl;
    img.alt = "";
    img.onerror = () => {
      pageFavicon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.4"/>
      </svg>`;
    };
    pageFavicon.appendChild(img);
  } catch {
    pageTitle.textContent = "Unable to read page";
  }
}

// ============================================================
//  Cache Check
// ============================================================

async function checkCachedSummary() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const key = `cache_${btoa(tab.url).slice(0, 50)}`;
    const result = await chrome.storage.local.get([key]);
    const entry = result[key];

    if (entry && Date.now() - entry.timestamp < 30 * 60 * 1000) {
      renderResult(entry.data, true);
    }
  } catch {
    // Silently ignore — fresh state is fine
  }
}

// ============================================================
//  Summarize Flow
// ============================================================

async function handleSummarize() {
  if (isLoading) return;

  isLoading = true;
  setLoadingState("Extracting content...", 15);
  showState("loading");
  btnSummarize.disabled = true;
  btnSummarize.classList.add("loading");
  btnSummarize.textContent = "Summarizing...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");

    // Check if the URL is summarizable
    if (!isValidUrl(tab.url)) {
      throw new Error("This page cannot be summarized. Try navigating to an article or webpage.");
    }

    // Step 1: Extract content from page
    setLoadingState("Extracting content...", 30);
    const extractionResult = await sendMessageToTab(tab.id, { action: "EXTRACT_CONTENT" });

    if (!extractionResult?.success) {
      throw new Error(extractionResult?.error || "Failed to extract page content.");
    }

    const { content, title, url } = extractionResult.data;

    if (!content || content.trim().length < 50) {
      throw new Error("Not enough content found on this page to summarize.");
    }

    // Step 2: Send to background for AI call
    setLoadingState("Analyzing with AI...", 65);
    const summaryResult = await chrome.runtime.sendMessage({
      action: "SUMMARIZE",
      payload: { content, title, url }
    });

    if (!summaryResult?.success) {
      throw new Error(summaryResult?.error || "AI summarization failed.");
    }

    setLoadingState("Formatting summary...", 90);
    await sleep(300);

    renderResult(summaryResult.data, false);

  } catch (err) {
    showError(err.message || "An unexpected error occurred.");
  } finally {
    isLoading = false;
    btnSummarize.disabled = false;
    btnSummarize.classList.remove("loading");
    btnSummarize.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      Summarize Page`;
  }
}

// ============================================================
//  Render Result
// ============================================================

function renderResult(data, isCached) {
  currentSummary = data;

  // Stats
  $("statReadTime").textContent = data.readingTime || "—";
  $("statWords").textContent = data.wordCount ? `${data.wordCount.toLocaleString()} words` : "—";
  $("statTopic").textContent = data.topic || "General";

  // Cached badge
  const cachedBadge = $("cachedBadge");
  if (isCached) cachedBadge.classList.remove("hidden");
  else cachedBadge.classList.add("hidden");

  // Summary bullets
  const summaryList = $("summaryList");
  summaryList.innerHTML = "";
  if (Array.isArray(data.summary)) {
    data.summary.forEach((point, i) => {
      const li = document.createElement("li");
      li.textContent = point; // Safe: textContent, not innerHTML
      li.style.animationDelay = `${i * 60}ms`;
      summaryList.appendChild(li);
    });
  }

  // Key insights
  const insightsList = $("insightsList");
  const insightsSection = $("insightsSection");
  insightsList.innerHTML = "";

  if (Array.isArray(data.keyInsights) && data.keyInsights.length > 0) {
    insightsSection.classList.remove("hidden");
    data.keyInsights.forEach((insight, i) => {
      const li = document.createElement("li");
      const marker = document.createElement("span");
      marker.className = "insight-marker";
      marker.textContent = "💡";
      const text = document.createElement("span");
      text.textContent = insight; // Safe: textContent
      li.appendChild(marker);
      li.appendChild(text);
      li.style.animationDelay = `${i * 80}ms`;
      insightsList.appendChild(li);
    });
  } else {
    insightsSection.classList.add("hidden");
  }

  showState("result");
  btnCopy.classList.remove("hidden");
  btnClear.classList.remove("hidden");
}

// ============================================================
//  Actions
// ============================================================

function handleClear() {
  currentSummary = null;
  showState("idle");
  btnCopy.classList.add("hidden");
  btnClear.classList.add("hidden");
}

async function handleCopy() {
  if (!currentSummary) return;

  try {
    const text = formatSummaryAsText(currentSummary);
    await navigator.clipboard.writeText(text);

    btnCopy.classList.add("copied");
    btnCopy.title = "Copied!";

    const origSvg = btnCopy.innerHTML;
    btnCopy.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    setTimeout(() => {
      btnCopy.classList.remove("copied");
      btnCopy.title = "Copy summary";
      btnCopy.innerHTML = origSvg;
    }, 2000);
  } catch {
    // Clipboard not available — silent fail
  }
}

function formatSummaryAsText(data) {
  const lines = [];
  lines.push(`📄 PageMind Summary`);
  lines.push(`⏱ ${data.readingTime}  |  📝 ${data.wordCount} words  |  🏷 ${data.topic}`);
  lines.push(``);
  lines.push(`Summary:`);
  data.summary.forEach((p) => lines.push(`• ${p}`));
  if (data.keyInsights?.length) {
    lines.push(``);
    lines.push(`Key Insights:`);
    data.keyInsights.forEach((i) => lines.push(`💡 ${i}`));
  }
  return lines.join("\n");
}

// ============================================================
//  Theme
// ============================================================

function loadTheme() {
  chrome.storage.local.get(["theme"], (result) => {
    const theme = result.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  chrome.storage.local.set({ theme: next });
}

// ============================================================
//  UI Helpers
// ============================================================

function showState(state) {
  stateIdle.classList.add("hidden");
  stateLoading.classList.add("hidden");
  stateError.classList.add("hidden");
  stateResult.classList.add("hidden");

  if (state === "idle") stateIdle.classList.remove("hidden");
  else if (state === "loading") stateLoading.classList.remove("hidden");
  else if (state === "error") stateError.classList.remove("hidden");
  else if (state === "result") stateResult.classList.remove("hidden");
}

function setLoadingState(text, progress) {
  loadingText.textContent = text;
  loadingFill.style.width = `${progress}%`;
}

function showError(msg) {
  errorMsg.textContent = msg;
  showState("error");
  btnCopy.classList.add("hidden");
  btnClear.classList.remove("hidden");
}

function isValidUrl(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // Content script may not be injected — try scripting API
        resolve({ success: false, error: "Content script not ready. Reload the page and try again." });
      } else {
        resolve(response);
      }
    });
  });
}
