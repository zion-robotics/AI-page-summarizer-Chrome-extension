// ============================================================
//  PageMind — Content Script
//  Extracts meaningful readable content from the page
//  Uses heuristic filtering to avoid nav/footer clutter
// ============================================================

(function () {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "EXTRACT_CONTENT") return false;

    try {
      const result = extractPageContent();
      sendResponse({ success: true, data: result });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }

    return true;
  });

  function extractPageContent() {
    const title = document.title || "";
    const url = window.location.href;

    // Try to find the main article content first
    const content = extractMainContent();
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    return { title, url, content, wordCount };
  }

  function extractMainContent() {
    // Priority order: semantic HTML elements most likely to contain article content
    const primarySelectors = [
      "article",
      "[role='main']",
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".article-body",
      ".post-body",
      ".story-body",
      ".content-body",
      "#article-body",
      "#main-content",
      "#content"
    ];

    for (const selector of primarySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = extractText(el);
        if (text.length > 200) return text;
      }
    }

    // Fallback: score all block elements and pick the best
    return extractByDensity();
  }

  function extractText(element) {
    // Clone to avoid mutating the DOM
    const clone = element.cloneNode(true);

    // Remove noise elements
    const noiseSelectors = [
      "nav", "header", "footer", "aside",
      ".nav", ".navigation", ".sidebar", ".widget",
      ".advertisement", ".ad", ".ads",
      ".social-share", ".share-buttons",
      ".comments", ".comment-section",
      ".related-posts", ".recommended",
      "script", "style", "noscript",
      "form", "button", "input", "select"
    ];

    noiseSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    return cleanText(clone.innerText || clone.textContent || "");
  }

  function extractByDensity() {
    const candidates = document.querySelectorAll(
      "div, section, article, main, .content, #content, p"
    );

    let best = { el: null, score: 0 };

    candidates.forEach((el) => {
      const text = el.innerText || el.textContent || "";
      const words = text.trim().split(/\s+/).length;
      const links = el.querySelectorAll("a").length;
      const paragraphs = el.querySelectorAll("p").length;

      // Score: favor high word count, many paragraphs, few links (avoids nav)
      const score = words - links * 3 + paragraphs * 5;

      if (score > best.score && words > 100) {
        best = { el, score };
      }
    });

    if (best.el) return cleanText(best.el.innerText || best.el.textContent || "");

    // Last resort: body text
    return cleanText(document.body.innerText || document.body.textContent || "");
  }

  function cleanText(text) {
    return text
      .replace(/\t/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .trim()
      .slice(0, 12000); // Hard cap before sending
  }
})();
