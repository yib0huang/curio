const MAX_PAGE_CHARS = 50000;

function extractPage() {
  const root = document.querySelector("main, article, [role='main']") || document.body;
  const copy = root.cloneNode(true);

  copy
    .querySelectorAll(
      "script, style, noscript, svg, canvas, iframe, nav, footer, form, button, input, textarea, select, [aria-hidden='true']"
    )
    .forEach((node) => node.remove());

  const text = (copy.innerText || copy.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PAGE_CHARS);

  const description =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    "";

  return {
    title: document.title,
    url: location.href,
    description,
    text,
    capturedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CURIO_READ_PAGE") return;

  try {
    sendResponse({ ok: true, page: extractPage() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
