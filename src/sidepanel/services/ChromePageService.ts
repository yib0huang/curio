import type { PageSnapshot, ReadPageResponse } from "../../shared/types";

export interface ActivePageResult {
  tabId: number | null;
  page: PageSnapshot | null;
  status: string;
  error?: string;
}

/** 封装活动标签页查询以及与内容脚本的消息通信。 */
export class ChromePageService {
  /** 读取当前窗口的活动网页。 */
  async readActivePage(): Promise<ActivePageResult> {
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
      const result = await chrome.tabs.sendMessage<
        { type: "CURIO_READ_PAGE" },
        ReadPageResponse
      >(tabId, { type: "CURIO_READ_PAGE" });

      if (!result.ok) throw new Error(result.error);
      return {
        tabId,
        page: result.page,
        status: result.page.text
          ? `已读取 ${result.page.text.length.toLocaleString()} 字符`
          : "页面没有可读取的正文"
      };
    } catch {
      return {
        tabId,
        page: null,
        status: "请刷新网页后重试",
        error: "无法连接到当前页面。扩展首次安装后，请刷新这个网页再试。"
      };
    }
  }
}
