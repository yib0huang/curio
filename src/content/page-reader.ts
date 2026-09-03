import type { ReadPageMessage, ReadPageResponse } from "../shared/types";
import { extractFrame, extractFrameWithVirtualPages } from "./page-extractor";

/**
 * @file 当前 frame 的网页内容读取入口。
 * 脚本会注入顶层页面和可访问子 frame，由侧边栏按 frameId 分别收集结果。
 */

chrome.runtime.onMessage.addListener(
  (message: ReadPageMessage, _sender, sendResponse: (response: ReadPageResponse) => void) => {
    if (message?.type !== "CURIO_READ_PAGE") return;

    const extraction = message.scanVirtualPages
      ? extractFrameWithVirtualPages(document, location.href)
      : Promise.resolve(extractFrame(document, location.href));
    void extraction
      .then((page) => sendResponse({ ok: true, page }))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }
);
