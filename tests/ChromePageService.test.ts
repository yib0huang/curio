// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { ChromePageService } from "../src/sidepanel/services/ChromePageService";
import type { PageSnapshot } from "../src/shared/types";

function createPage(title: string, url: string, text: string): PageSnapshot {
  return {
    title,
    url,
    description: "",
    text,
    capturedAt: "2026-09-03T00:00:00.000Z",
    extraction: {
      frameCount: 1,
      inaccessibleFrameCount: 0,
      shadowRootCount: 0,
      sourceCharacters: text.length,
      truncated: false,
      mode: "structured-dom"
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("ChromePageService", () => {
  it("按 frameId 读取并合并顶层页面与嵌入区域", async () => {
    const pages = new Map([
      [0, createPage("控制台", "https://example.com", "当前位置 当前页面")],
      [3, createPage("日志模块", "https://logs.example.com", "82414 条日志\npermission denied")]
    ]);
    const sendMessage = vi.fn(async (
      _tabId: number,
      _message: { scanVirtualPages?: boolean },
      options: { frameId: number }
    ) => ({ ok: true, page: pages.get(options.frameId) }));
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn(async () => [{ id: 7, url: "https://example.com", title: "控制台" }]),
        sendMessage
      },
      webNavigation: {
        getAllFrames: vi.fn(async () => [
          { frameId: 0, parentFrameId: -1, url: "https://example.com" },
          { frameId: 3, parentFrameId: 0, url: "https://logs.example.com" }
        ])
      }
    });

    const result = await new ChromePageService().readActivePage({ scanVirtualPages: true });

    expect(result.page?.text).toContain("## 主页面");
    expect(result.page?.text).toContain("## 日志模块");
    expect(result.page?.text).toContain("82414 条日志");
    expect(result.page?.extraction?.frameCount).toBe(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.map((call) => call[2].frameId)).toEqual([0, 3]);
    expect(sendMessage.mock.calls.every((call) => call[1].scanVirtualPages === true)).toBe(true);
  });

  it("部分 frame 不可访问时仍返回可用内容并提示覆盖缺口", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn(async () => [{ id: 8, url: "https://example.com", title: "页面" }]),
        sendMessage: vi.fn(async (
          _tabId: number,
          _message: object,
          options: { frameId: number }
        ) => {
          if (options.frameId === 2) throw new Error("不可访问");
          return { ok: true, page: createPage("页面", "https://example.com", "可用正文") };
        })
      },
      webNavigation: {
        getAllFrames: vi.fn(async () => [
          { frameId: 0, parentFrameId: -1, url: "https://example.com" },
          { frameId: 2, parentFrameId: 0, url: "https://blocked.example" }
        ])
      }
    });

    const result = await new ChromePageService().readActivePage();

    expect(result.page?.text).toBe("可用正文");
    expect(result.page?.extraction?.inaccessibleFrameCount).toBe(1);
    expect(result.error).toContain("1 个嵌入区域");
  });
});
