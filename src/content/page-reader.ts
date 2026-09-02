import type { PageSnapshot, ReadPageMessage, ReadPageResponse } from "../shared/types";

/**
 * @file 当前网页内容提取脚本。
 * 该脚本运行在页面上下文中，仅在收到侧边栏消息后返回整理后的页面快照。
 */

// 限制提交给模型的正文体积，防止超长页面造成请求失败或不必要的费用。
const MAX_PAGE_CHARS = 50000;
const MIN_ARTICLE_CHARS = 400;

const NOISE_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "footer",
  "aside",
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "dialog",
  "menu",
  "details:not([open])",
  "[hidden]",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='complementary']",
  "[role='dialog']",
  "[role='menu']",
  "[role='menubar']",
  "[role='toolbar']",
  "[role='tablist']",
  "[role='alert']",
  "[role='status']",
  "[aria-live]",
  ".visually-hidden",
  ".sr-only"
].join(", ");

/** 返回候选节点清理空白后的文本长度，用于比较正文完整度。 */
function getCandidateTextLength(element: Element): number {
  return (element.textContent || "").replace(/\s+/g, " ").trim().length;
}

/** 从候选集合中选择文本最完整的节点。 */
function findLongestElement(elements: Element[]): Element | null {
  return elements.reduce<Element | null>((longest, element) => {
    if (!longest) return element;
    return getCandidateTextLength(element) > getCandidateTextLength(longest)
      ? element
      : longest;
  }, null);
}

/**
 * 优先选择语义化文章，避免把站点导航和页面操作区作为正文。
 * 短文章常是推荐卡片，因此只有达到最低长度时才优先采用。
 */
function findContentRoot(): Element {
  const article = findLongestElement(Array.from(document.querySelectorAll("article")));
  if (article && getCandidateTextLength(article) >= MIN_ARTICLE_CHARS) return article;

  return (
    findLongestElement(Array.from(document.querySelectorAll("main, [role='main']"))) ||
    document.body
  );
}

/** 生成不影响原页面的清理副本，并移除常见布局与交互噪声。 */
function createCleanCopy(root: Element): HTMLElement {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(NOISE_SELECTOR).forEach((node) => node.remove());
  return copy;
}

/** 将行内节点压缩为可读文本，同时保留换行和行内代码语义。 */
function renderInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof Element)) return "";

  const tagName = node.tagName.toLowerCase();
  if (tagName === "br") return "\n";
  if (tagName === "img") return "";

  const content = Array.from(node.childNodes).map(renderInline).join("");
  if (tagName === "code") {
    const code = content.replace(/\s+/g, " ").trim();
    return code ? `\`${code.replace(/`/g, "\\`")}\`` : "";
  }

  return content;
}

/** 清理行内元素产生的布局空白，避免相邻文字黏连。 */
function cleanInlineText(node: Node): string {
  return renderInline(node)
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** 将代码块包装为 Markdown 围栏，并避免与代码自身的反引号冲突。 */
function renderCodeBlock(element: Element): string {
  const code = (element.textContent || "").replace(/\r\n?/g, "\n").trim();
  if (!code) return "";

  const longestFence = Math.max(
    2,
    ...Array.from(code.matchAll(/`+/g), (match) => match[0].length)
  );
  const fence = "`".repeat(longestFence + 1);
  return `\n\n${fence}\n${code}\n${fence}\n\n`;
}

/** 将列表转换为 Markdown，并保留有序列表序号与嵌套层级。 */
function renderList(element: Element, depth: number): string {
  const ordered = element.tagName.toLowerCase() === "ol";
  const start = Number.parseInt(element.getAttribute("start") || "1", 10);
  const items = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === "li"
  );

  return items
    .map((item, index) => {
      const nestedLists = Array.from(item.children).filter((child) =>
        ["ul", "ol"].includes(child.tagName.toLowerCase())
      );
      const nestedSet = new Set(nestedLists);
      const itemText = Array.from(item.childNodes)
        .filter((child) => !(child instanceof Element && nestedSet.has(child)))
        .map((child) => renderBlock(child, depth))
        .join("")
        .replace(/\n{2,}/g, "\n")
        .trim();
      const indent = "  ".repeat(depth);
      const marker = ordered ? `${start + index}.` : "-";
      const body = itemText
        .split("\n")
        .map((line, lineIndex) =>
          lineIndex === 0 ? `${indent}${marker} ${line}` : `${indent}  ${line}`
        )
        .join("\n");
      const nested = nestedLists.map((list) => renderList(list, depth + 1)).join("");
      return `${body}\n${nested}`;
    })
    .join("");
}

/** 将简单数据表转换为 Markdown 表格，复杂表格仍保留逐行单元格文本。 */
function renderTable(element: Element): string {
  const rows = Array.from(element.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) =>
        cleanInlineText(cell).replace(/\|/g, "\\|")
      )
    )
    .filter((cells) => cells.some(Boolean));

  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const lines = rows.map(
    (row) => `| ${Array.from({ length: columnCount }, (_, index) => row[index] || "").join(" | ")} |`
  );
  const firstRow = element.querySelector("tr");
  if (firstRow?.querySelector("th")) {
    lines.splice(1, 0, `| ${Array(columnCount).fill("---").join(" | ")} |`);
  }
  return `\n\n${lines.join("\n")}\n\n`;
}

/** 按元素语义递归生成 Markdown 风格正文。 */
function renderBlock(node: Node, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || "").replace(/\s+/g, " ");
  }
  if (!(node instanceof Element)) return "";

  const tagName = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    const heading = cleanInlineText(node);
    return heading ? `\n\n${"#".repeat(Number(tagName[1]))} ${heading}\n\n` : "";
  }
  if (tagName === "p") {
    const paragraph = cleanInlineText(node);
    return paragraph ? `\n\n${paragraph}\n\n` : "";
  }
  if (tagName === "pre") return renderCodeBlock(node);
  if (tagName === "ul" || tagName === "ol") return `\n${renderList(node, listDepth)}\n`;
  if (tagName === "table") return renderTable(node);
  if (tagName === "blockquote") {
    const quote = Array.from(node.childNodes)
      .map((child) => renderBlock(child, listDepth))
      .join("")
      .trim();
    return quote
      ? `\n\n${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`
      : "";
  }
  if (tagName === "hr") return "\n\n---\n\n";
  if (tagName === "br") return "\n";
  if (tagName === "code") return cleanInlineText(node);

  const content = Array.from(node.childNodes)
    .map((child) => renderBlock(child, listDepth))
    .join("");
  return [
    "article",
    "main",
    "section",
    "div",
    "header",
    "figure",
    "figcaption",
    "details",
    "summary",
    "dl",
    "dt",
    "dd"
  ].includes(tagName)
    ? `\n${content}\n`
    : content;
}

/** 规整 Markdown 空行并移除网页中常见的孤立编码空白占位。 */
function cleanStructuredText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !/^(?:\s|&#x20;|&#32;|&nbsp;)+$/i.test(line))
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 从当前文档中提取适合模型阅读的页面快照。
 *
 * @returns 页面标题、地址、摘要、清理后的正文和采集时间。
 */
function extractPage(): PageSnapshot {
  const copy = createCleanCopy(findContentRoot());
  const text = cleanStructuredText(renderBlock(copy)).slice(0, MAX_PAGE_CHARS).trim();

  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
    "";

  return {
    title: document.title,
    url: location.href,
    description,
    text,
    capturedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener(
  (message: ReadPageMessage, _sender, sendResponse: (response: ReadPageResponse) => void) => {
    if (message?.type !== "CURIO_READ_PAGE") return;

    // 捕获提取异常并序列化错误，避免消息通道因未处理异常而静默断开。
    try {
      sendResponse({ ok: true, page: extractPage() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);
