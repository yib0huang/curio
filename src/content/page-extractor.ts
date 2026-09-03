import type { PageSnapshot } from "../shared/types";

/**
 * @file 将单个文档转换为适合模型读取的结构化文本。
 * 提取以当前已加载 DOM 为边界，兼顾文章页、管理后台、表格和开放 Shadow DOM。
 */

export const MAX_PAGE_CHARS = 120000;

const SKIPPED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed"
]);

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "div",
  "dl",
  "dt",
  "dd",
  "figcaption",
  "figure",
  "footer",
  "form",
  "header",
  "main",
  "nav",
  "section"
]);

const CELL_ROLES = new Set(["cell", "columnheader", "gridcell", "rowheader"]);

interface RenderState {
  shadowRootCount: number;
  seenAssignedNodes: WeakSet<Node>;
  omitVirtualDocumentSvg: boolean;
}

interface VirtualDocumentPage {
  pageNumber?: number;
  position: number;
  text: string;
}

/** 规整空白，同时保留 Markdown 的段落和行边界。 */
export function cleanStructuredText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .filter((line, index, lines) => line || (index > 0 && Boolean(lines[index - 1])))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 页面显式隐藏的节点不属于用户当前可见上下文。 */
function isExplicitlyHidden(element: Element): boolean {
  if (
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert") ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return true;
  }

  const style = element.getAttribute("style")?.toLowerCase() || "";
  if (/(?:^|;)\s*display\s*:\s*none\b/.test(style) ||
    /(?:^|;)\s*visibility\s*:\s*hidden\b/.test(style) ||
    /(?:^|;)\s*content-visibility\s*:\s*hidden\b/.test(style)) {
    return true;
  }

  try {
    const computedStyle = element.ownerDocument.defaultView?.getComputedStyle(element);
    return computedStyle?.display === "none" ||
      computedStyle?.visibility === "hidden" ||
      computedStyle?.contentVisibility === "hidden";
  } catch {
    return false;
  }
}

function isEditable(element: Element): boolean {
  const contentEditable = element.getAttribute("contenteditable")?.toLowerCase();
  return contentEditable === "" || contentEditable === "true" || contentEditable === "plaintext-only";
}

/** 获取控件或非文本视觉元素的无障碍名称，但不读取用户输入值。 */
function getAccessibleLabel(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean);
    if (labels.length) return labels.join(" ");
  }

  return (
    element.getAttribute("alt")?.trim() ||
    element.getAttribute("title")?.trim() ||
    element.getAttribute("placeholder")?.trim() ||
    ""
  );
}

/** Slot 使用实际分配节点，避免 Shadow DOM 中只得到一个空占位符。 */
function getRenderedChildren(element: Element, state: RenderState): Node[] {
  const shadowRoot = (element as HTMLElement).shadowRoot;
  if (shadowRoot) {
    state.shadowRootCount += 1;
    return Array.from(shadowRoot.childNodes);
  }

  if (element.tagName.toLowerCase() === "slot") {
    const assignedNodes = (element as HTMLSlotElement).assignedNodes?.({ flatten: true }) || [];
    if (assignedNodes.length) {
      return assignedNodes.filter((node) => {
        if (state.seenAssignedNodes.has(node)) return false;
        state.seenAssignedNodes.add(node);
        return true;
      });
    }
  }

  return Array.from(element.childNodes);
}

/** 将节点的可见文本压缩为单行，供表格单元格和控件使用。 */
function renderInline(node: Node, state: RenderState): string {
  if (node.nodeType === 3) return node.textContent || "";
  if (node.nodeType !== 1) return "";

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  if (SKIPPED_TAGS.has(tagName) || isExplicitlyHidden(element)) return "";
  if (tagName === "br") return "\n";
  if (tagName === "input" || tagName === "textarea" || isEditable(element)) {
    return getAccessibleLabel(element);
  }
  if (tagName === "svg") {
    if (state.omitVirtualDocumentSvg && isVirtualDocumentSvg(element)) return "";
    return renderSvgText(element) || getAccessibleLabel(element);
  }
  if (["img", "canvas", "video", "audio"].includes(tagName)) {
    return getAccessibleLabel(element);
  }

  const content = getRenderedChildren(element, state).map((child) => renderInline(child, state)).join("");
  if (content.trim()) return content;
  return getAccessibleLabel(element);
}

function cleanInlineText(node: Node, state: RenderState): string {
  return renderInline(node, state)
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * 提取 SVG 文档中的文本绘制节点。
 * WPS、PDF.js 衍生阅读器等应用常把一页内容放在多个 `<text>/<tspan>` 中，DOM 顺序通常即阅读顺序。
 */
function renderSvgText(element: Element): string {
  const textElements = element.tagName.toLowerCase() === "text"
    ? [element]
    : Array.from(element.querySelectorAll("text"));
  return cleanStructuredText(
    textElements
      .filter((textElement) => !isExplicitlyHidden(textElement))
      .map((textElement) => (textElement.textContent || "").replace(/\s+/g, " ").trim())
      .filter((line) => !/[\p{Co}\uFFFD]/u.test(line))
      .filter(Boolean)
      .join("\n")
  );
}

function isVirtualDocumentSvg(element: Element): boolean {
  return element.matches("svg.text-page, .canvas-unit svg");
}

function getVirtualDocumentSvgs(document: Document): Element[] {
  const textPages = Array.from(document.querySelectorAll("svg.text-page"));
  return textPages.length
    ? textPages
    : Array.from(document.querySelectorAll(".canvas-unit svg"));
}

/** 将普通 HTML 表格或 ARIA table/grid 转换为 Markdown 表格。 */
function renderTable(element: Element, state: RenderState): string {
  const rowElements = element.tagName.toLowerCase() === "table"
    ? Array.from(element.querySelectorAll("tr"))
    : Array.from(element.querySelectorAll('[role="row"]'));

  const rows = rowElements
    .map((row) => {
      const cells = row.tagName.toLowerCase() === "tr"
        ? Array.from(row.children).filter((child) => ["th", "td"].includes(child.tagName.toLowerCase()))
        : Array.from(row.querySelectorAll(
            ':scope > [role="cell"], :scope > [role="columnheader"], :scope > [role="gridcell"], :scope > [role="rowheader"]'
          ));
      return cells.map((cell) => cleanInlineText(cell, state).replace(/\|/g, "\\|"));
    })
    .filter((cells) => cells.some(Boolean));

  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map(
    (row) => `| ${Array.from({ length: columnCount }, (_, index) => row[index] || "").join(" | ")} |`
  );
  const firstRow = rowElements[0];
  const hasHeader = Boolean(
    firstRow?.querySelector('th, [role="columnheader"], [role="rowheader"]')
  );
  if (hasHeader) {
    normalizedRows.splice(1, 0, `| ${Array(columnCount).fill("---").join(" | ")} |`);
  }
  return `\n\n${normalizedRows.join("\n")}\n\n`;
}

/** 将列表转换为 Markdown，并保留嵌套层级。 */
function renderList(element: Element, state: RenderState, depth: number): string {
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
        .filter((child) => !(child.nodeType === 1 && nestedSet.has(child as Element)))
        .map((child) => renderBlock(child, state, depth))
        .join("")
        .replace(/\n{2,}/g, "\n")
        .trim();
      const marker = ordered ? `${start + index}.` : "-";
      const indent = "  ".repeat(depth);
      const body = itemText
        .split("\n")
        .map((line, lineIndex) =>
          lineIndex === 0 ? `${indent}${marker} ${line}` : `${indent}  ${line}`
        )
        .join("\n");
      const nested = nestedLists.map((list) => renderList(list, state, depth + 1)).join("");
      return `${body}\n${nested}`;
    })
    .join("");
}

/** 递归生成 Markdown 风格正文，并穿透开放 Shadow DOM。 */
function renderBlock(node: Node, state: RenderState, listDepth = 0): string {
  if (node.nodeType === 3) return (node.textContent || "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase() || "";
  if (SKIPPED_TAGS.has(tagName) || isExplicitlyHidden(element)) return "";

  if (tagName === "input" || tagName === "textarea" || isEditable(element)) {
    const label = getAccessibleLabel(element);
    return label ? ` ${label} ` : "";
  }
  if (tagName === "svg") {
    if (state.omitVirtualDocumentSvg && isVirtualDocumentSvg(element)) return "";
    const svgText = renderSvgText(element);
    const content = svgText || getAccessibleLabel(element);
    return content ? `\n\n${content}\n\n` : "";
  }
  if (["img", "canvas", "video", "audio"].includes(tagName)) {
    const label = getAccessibleLabel(element);
    return label ? `\n\n[${label}]\n\n` : "";
  }
  if (/^h[1-6]$/.test(tagName) || role === "heading") {
    const heading = cleanInlineText(element, state);
    const ariaLevel = Number.parseInt(element.getAttribute("aria-level") || "2", 10);
    const level = /^h[1-6]$/.test(tagName) ? Number(tagName[1]) : Math.min(Math.max(ariaLevel, 1), 6);
    return heading ? `\n\n${"#".repeat(level)} ${heading}\n\n` : "";
  }
  if (tagName === "pre") {
    const code = (element.textContent || "").replace(/\r\n?/g, "\n").trim();
    if (!code) return "";
    const longestFence = Math.max(2, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
    const fence = "`".repeat(longestFence + 1);
    return `\n\n${fence}\n${code}\n${fence}\n\n`;
  }
  if (tagName === "table" || role === "table" || role === "grid" || role === "treegrid") {
    const table = renderTable(element, state);
    if (table) return table;
  }
  if (tagName === "ul" || tagName === "ol") return `\n${renderList(element, state, listDepth)}\n`;
  if (tagName === "blockquote") {
    const quote = getRenderedChildren(element, state)
      .map((child) => renderBlock(child, state, listDepth))
      .join("")
      .trim();
    return quote ? `\n\n${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n` : "";
  }
  if (tagName === "hr") return "\n\n---\n\n";
  if (tagName === "br") return "\n";
  if (tagName === "code") {
    const code = cleanInlineText(element, state);
    return code ? `\`${code.replace(/`/g, "\\`")}\`` : "";
  }

  const content = getRenderedChildren(element, state)
    .map((child) => renderBlock(child, state, listDepth))
    .join("");
  if (content.trim()) {
    return BLOCK_TAGS.has(tagName) || ["row", ...CELL_ROLES].includes(role)
      ? `\n${content}\n`
      : content;
  }

  const label = getAccessibleLabel(element);
  return label ? ` ${label} ` : "";
}

/** 浏览器的 `innerText` 用于交叉检查结构化遍历是否发生大面积漏读。 */
function getVisibleText(document: Document): string {
  const body = document.body;
  if (!body) return "";
  const innerText = "innerText" in body ? (body as HTMLElement).innerText : "";
  return cleanStructuredText(innerText || "");
}

/**
 * 提取一个 frame 内当前已加载的页面内容。
 * 结构化结果异常短时使用完整可见文本兜底，避免错误候选造成“读取成功但几乎为空”。
 */
function extractFrameContent(
  document: Document,
  url: string,
  omitVirtualDocumentSvg: boolean
): PageSnapshot {
  const state: RenderState = {
    shadowRootCount: 0,
    seenAssignedNodes: new WeakSet<Node>(),
    omitVirtualDocumentSvg
  };
  const structuredText = document.body
    ? cleanStructuredText(renderBlock(document.body, state))
    : "";
  const visibleText = getVisibleText(document);
  const useVisibleFallback =
    !omitVirtualDocumentSvg && visibleText.length > structuredText.length * 1.35 + 200;
  const unboundedText = useVisibleFallback ? visibleText : structuredText;
  const text = unboundedText.slice(0, MAX_PAGE_CHARS).trim();
  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
    "";

  return {
    title: document.title,
    url,
    description,
    text,
    capturedAt: new Date().toISOString(),
    extraction: {
      frameCount: 1,
      inaccessibleFrameCount: 0,
      shadowRootCount: state.shadowRootCount,
      sourceCharacters: unboundedText.length,
      truncated: unboundedText.length > text.length,
      mode: useVisibleFallback ? "visible-text" : "structured-dom"
    }
  };
}

/** 同步提取当前 frame 已经挂载在 DOM 中的内容。 */
export function extractFrame(document: Document, url: string): PageSnapshot {
  return extractFrameContent(document, url, false);
}

function findScrollContainer(element: Element): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    const canScroll = current.scrollHeight > current.clientHeight + 100;
    if (canScroll && /auto|scroll/.test(style?.overflowY || "")) return current;
    current = current.parentElement;
  }
  return null;
}

function collectVirtualDocumentPages(
  document: Document,
  scrollContainer: HTMLElement | null,
  pages: Map<string, VirtualDocumentPage>
): void {
  const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
  const scrollTop = scrollContainer?.scrollTop ?? 0;
  const svgs = getVirtualDocumentSvgs(document);
  const currentPageNumber = getCurrentPageNumber(document);
  for (const [index, svg] of svgs.entries()) {
    const text = renderSvgText(svg);
    if (!text) continue;
    const fingerprint = text.replace(/\s+/g, " ").trim();
    const key = currentPageNumber && svgs.length === 1
      ? `page:${currentPageNumber}`
      : `${fingerprint}:${index}`;
    if (pages.has(key)) continue;
    const position = scrollContainer
      ? svg.getBoundingClientRect().top - containerTop + scrollTop
      : pages.size;
    pages.set(key, {
      pageNumber: svgs.length === 1 ? currentPageNumber ?? undefined : undefined,
      position,
      text
    });
  }
}

function getCurrentPageNumber(document: Document): number | null {
  const match = (document.body?.textContent || "").match(/页面\s*[:：]\s*(\d+)\s*\/\s*\d+/);
  if (!match) return null;
  const current = Number.parseInt(match[1], 10);
  return Number.isFinite(current) && current > 0 ? current : null;
}

function getDeclaredPageCount(document: Document): number | null {
  const match = (document.body?.textContent || "").match(/页面\s*[:：]\s*\d+\s*\/\s*(\d+)/);
  if (!match) return null;
  const count = Number.parseInt(match[1], 10);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 100) : null;
}

function getVirtualDocumentSignature(document: Document): string {
  return getVirtualDocumentSvgs(document)
    .map((svg) => renderSvgText(svg))
    .filter(Boolean)
    .join("\n---\n");
}

function delay(document: Document, milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const view = document.defaultView;
    if (view) view.setTimeout(resolve, milliseconds);
    else globalThis.setTimeout(resolve, milliseconds);
  });
}

/** 等待滚动后的 SVG 正文发生变化并连续四次保持稳定，慢页面则等待到超时。 */
async function waitForVirtualRender(
  document: Document,
  previousSignature: string,
  timeoutMilliseconds = 3000
): Promise<void> {
  const startedAt = Date.now();
  let lastSignature = previousSignature;
  let stableChecks = 0;
  let changed = false;

  while (Date.now() - startedAt < timeoutMilliseconds) {
    await delay(document, 100);
    const signature = getVirtualDocumentSignature(document);
    if (signature && signature !== previousSignature) changed = true;
    stableChecks = changed && signature === lastSignature ? stableChecks + 1 : 0;
    if (stableChecks >= 4) return;
    lastSignature = signature;
  }
}

/**
 * 对 WPS 一类仅挂载当前页的虚拟文档执行有界扫描。
 * 扫描只改变内部滚动容器，最多访问 100 页或耗时 90 秒，并始终恢复用户原滚动位置。
 */
async function scanVirtualDocumentPages(document: Document): Promise<VirtualDocumentPage[]> {
  const firstPage = getVirtualDocumentSvgs(document)[0];
  if (!firstPage) return [];

  const scrollContainer = findScrollContainer(firstPage);
  const pages = new Map<string, VirtualDocumentPage>();
  collectVirtualDocumentPages(document, scrollContainer, pages);
  if (!scrollContainer) return Array.from(pages.values());

  const originalScrollTop = scrollContainer.scrollTop;
  const declaredPageCount = getDeclaredPageCount(document);
  if (declaredPageCount === 1) return Array.from(pages.values());
  const startedAt = Date.now();
  try {
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const renderedPageHeight = Math.round(firstPage.getBoundingClientRect().height);
    const step = Math.max(400, renderedPageHeight || Math.floor(scrollContainer.clientHeight * 0.9));
    const positionCount = declaredPageCount
      ? Math.min(100, declaredPageCount)
      : Math.min(100, Math.ceil(maxScrollTop / step) + 1);
    const positions = Array.from({ length: positionCount }, (_, index) => {
      if (declaredPageCount && positionCount > 1) {
        return Math.round((maxScrollTop * index) / (positionCount - 1));
      }
      return Math.min(index * step, maxScrollTop);
    }).filter((position, index, all) => index === 0 || position !== all[index - 1]);
    if (positions.length && positions.at(-1) !== maxScrollTop) {
      positions[positions.length - 1] = maxScrollTop;
    }

    for (const position of positions) {
      if (Math.abs(position - scrollContainer.scrollTop) < 2) continue;
      const previousSignature = getVirtualDocumentSignature(document);
      scrollContainer.scrollTop = position;
      await waitForVirtualRender(document, previousSignature);
      collectVirtualDocumentPages(document, scrollContainer, pages);
      if (declaredPageCount && pages.size >= declaredPageCount) break;
      if (Date.now() - startedAt >= 90000) break;
    }
  } finally {
    const restoreNeeded = Math.abs(scrollContainer.scrollTop - originalScrollTop) >= 2;
    const previousSignature = getVirtualDocumentSignature(document);
    scrollContainer.scrollTop = originalScrollTop;
    if (restoreNeeded) {
      await waitForVirtualRender(document, previousSignature, 3000);
    }
  }

  return Array.from(pages.values()).sort((left, right) => left.position - right.position);
}

/**
 * 提取 frame，并在检测到虚拟分页文档时主动收集已声明文档的各页文本。
 * 普通网页不会触发滚动扫描。
 */
export async function extractFrameWithVirtualPages(
  document: Document,
  url: string
): Promise<PageSnapshot> {
  const virtualPages = await scanVirtualDocumentPages(document);
  if (virtualPages.length <= 1) return extractFrame(document, url);

  const page = extractFrameContent(document, url, true);
  const documentText = virtualPages
    .map((virtualPage, index) =>
      `### 第 ${virtualPage.pageNumber ?? index + 1} 页\n\n${virtualPage.text}`
    )
    .join("\n\n");
  const unboundedText = [page.text, "## 分页文档内容", documentText]
    .filter(Boolean)
    .join("\n\n");
  page.text = unboundedText.slice(0, MAX_PAGE_CHARS).trim();
  if (page.extraction) {
    page.extraction.sourceCharacters += documentText.length;
    page.extraction.truncated = page.extraction.truncated || unboundedText.length > page.text.length;
    page.extraction.virtualPageCount = virtualPages.length;
  }
  return page;
}
