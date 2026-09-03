import type { PageSnapshot, ReadPageResponse } from "../../shared/types";

const MAX_COMBINED_PAGE_CHARS = 120000;

export interface ActivePageResult {
  tabId: number | null;
  page: PageSnapshot | null;
  status: string;
  error?: string;
}

export interface ReadActivePageOptions {
  /** 触发虚拟分页文档的有界滚动，仅用于会话首问。 */
  scanVirtualPages?: boolean;
}

interface FramePage {
  frame: FrameDescriptor;
  page: PageSnapshot;
}

interface FrameDescriptor {
  frameId: number;
  parentFrameId: number;
  url: string;
}

/** 按 frame 父子关系排序，保证主页面优先且嵌入区域尽量接近视觉层级。 */
function orderFrames(
  frames: FrameDescriptor[]
): FrameDescriptor[] {
  const children = new Map<number, FrameDescriptor[]>();
  for (const frame of frames) {
    const siblings = children.get(frame.parentFrameId) ?? [];
    siblings.push(frame);
    children.set(frame.parentFrameId, siblings);
  }

  const ordered: FrameDescriptor[] = [];
  const visit = (frame: FrameDescriptor) => {
    ordered.push(frame);
    for (const child of children.get(frame.frameId) ?? []) visit(child);
  };
  const mainFrame = frames.find((frame) => frame.frameId === 0);
  if (mainFrame) visit(mainFrame);
  for (const frame of frames) {
    if (!ordered.includes(frame)) visit(frame);
  }
  return ordered;
}

/** 去掉内容完全相同的嵌入区域，避免镜像 frame 重复占用模型上下文。 */
function deduplicateFramePages(framePages: FramePage[]): FramePage[] {
  const seen = new Set<string>();
  return framePages.filter(({ page }) => {
    const fingerprint = page.text.replace(/\s+/g, " ").trim();
    if (!fingerprint || seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

/** 将多个 frame 的结构化内容合并为一个有明确来源边界的页面快照。 */
function combineFramePages(
  tab: chrome.tabs.Tab,
  frames: FrameDescriptor[],
  framePages: FramePage[],
  inaccessibleFrameCount: number
): PageSnapshot {
  const orderedIds = orderFrames(frames).map((frame) => frame.frameId);
  const uniquePages = deduplicateFramePages(
    [...framePages].sort(
      (left, right) => orderedIds.indexOf(left.frame.frameId) - orderedIds.indexOf(right.frame.frameId)
    )
  );
  const mainPage = framePages.find(({ frame }) => frame.frameId === 0)?.page;
  const sections = uniquePages.map(({ frame, page }, index) => {
    if (uniquePages.length === 1) return page.text;
    const regionName = frame.frameId === 0
      ? "主页面"
      : page.title || `嵌入区域 ${index}`;
    const source = page.url && page.url !== tab.url ? `\n来源：${page.url}` : "";
    return `## ${regionName}${source}\n\n${page.text}`;
  });
  const unboundedText = sections.join("\n\n").trim();
  const text = unboundedText.slice(0, MAX_COMBINED_PAGE_CHARS).trim();
  const extractionItems = framePages.map(({ page }) => page.extraction);

  return {
    title: mainPage?.title || tab.title || "",
    url: tab.url || mainPage?.url || "",
    description: mainPage?.description || "",
    text,
    capturedAt: new Date().toISOString(),
    extraction: {
      frameCount: frames.length,
      inaccessibleFrameCount,
      shadowRootCount: extractionItems.reduce(
        (total, extraction) => total + (extraction?.shadowRootCount ?? 0),
        0
      ),
      sourceCharacters: extractionItems.reduce(
        (total, extraction) => total + (extraction?.sourceCharacters ?? 0),
        0
      ),
      truncated:
        unboundedText.length > text.length ||
        extractionItems.some((extraction) => extraction?.truncated),
      mode: framePages.length > 1
        ? "multi-frame"
        : (framePages[0]?.page.extraction?.mode ?? "structured-dom"),
      virtualPageCount: extractionItems.reduce(
        (total, extraction) => total + (extraction?.virtualPageCount ?? 0),
        0
      ) || undefined
    }
  };
}

/** 封装活动标签页查询以及多 frame 内容脚本通信。 */
export class ChromePageService {
  /** 读取当前窗口活动网页，并汇总所有能够访问的 frame。 */
  async readActivePage(options: ReadActivePageOptions = {}): Promise<ActivePageResult> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id ?? null;

    if (!tabId || !tab.url?.startsWith("http")) {
      return {
        tabId,
        page: null,
        status: "此页面受 Chrome 限制，无法读取"
      };
    }

    try {
      const discoveredFrames = await chrome.webNavigation.getAllFrames({ tabId });
      const frames = discoveredFrames?.length
        ? discoveredFrames
        : [{ frameId: 0, parentFrameId: -1, url: tab.url, processId: -1 }];
      const results = await Promise.allSettled(
        frames.map(async (frame): Promise<FramePage> => {
          const result = await chrome.tabs.sendMessage<
            { type: "CURIO_READ_PAGE"; scanVirtualPages?: boolean },
            ReadPageResponse
          >(
            tabId,
            { type: "CURIO_READ_PAGE", scanVirtualPages: options.scanVirtualPages },
            { frameId: frame.frameId }
          );
          if (!result.ok) throw new Error(result.error);
          return { frame, page: result.page };
        })
      );
      const framePages = results
        .filter((result): result is PromiseFulfilledResult<FramePage> => result.status === "fulfilled")
        .map((result) => result.value);
      const inaccessibleFrameCount = results.length - framePages.length;

      if (!framePages.length) throw new Error("所有页面区域均无法连接");
      const page = combineFramePages(tab, frames, framePages, inaccessibleFrameCount);
      const details = [
        `${page.text.length.toLocaleString()} 字符`,
        page.extraction && page.extraction.frameCount > 1
          ? `${page.extraction.frameCount - page.extraction.inaccessibleFrameCount}/${page.extraction.frameCount} 个页面区域`
          : "",
        page.extraction?.shadowRootCount
          ? `${page.extraction.shadowRootCount} 个 Shadow DOM`
          : "",
        page.extraction?.virtualPageCount
          ? `${page.extraction.virtualPageCount} 页文档`
          : "",
        page.extraction?.truncated ? "已截断" : ""
      ].filter(Boolean);

      return {
        tabId,
        page,
        status: page.text ? `已读取 ${details.join(" · ")}` : "页面没有可读取的正文",
        error: inaccessibleFrameCount
          ? `有 ${inaccessibleFrameCount} 个嵌入区域受页面权限或浏览器限制，未能读取。`
          : undefined
      };
    } catch {
      return {
        tabId,
        page: null,
        status: "请刷新网页后重试",
        error: "无法连接到当前页面。扩展首次安装或更新后，请刷新这个网页再试。"
      };
    }
  }
}
