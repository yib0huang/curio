/**
 * @file 当前网页内容提取脚本。
 * 该脚本运行在页面上下文中，仅在收到侧边栏消息后返回整理后的页面快照。
 */

// 限制提交给模型的正文体积，防止超长页面造成请求失败或不必要的费用。
const MAX_PAGE_CHARS = 50000;

/**
 * 从当前文档中提取适合模型阅读的页面快照。
 *
 * @returns {{title: string, url: string, description: string, text: string, capturedAt: string}}
 * 页面标题、地址、摘要、清理后的正文和采集时间。
 */
function extractPage() {
  const root = document.querySelector("main, article, [role='main']") || document.body;
  const copy = root.cloneNode(true);

  // 在副本上删除噪声和交互元素，绝不修改用户正在浏览的真实页面。
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

  // 捕获提取异常并序列化错误，避免消息通道因未处理异常而静默断开。
  try {
    sendResponse({ ok: true, page: extractPage() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
