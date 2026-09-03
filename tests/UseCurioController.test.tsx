// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  compressHistory: vi.fn(),
  loadSettings: vi.fn(),
  readActivePage: vi.fn()
}));

vi.mock("../src/sidepanel/services/ChromePageService", () => ({
  ChromePageService: class {
    readActivePage = mocks.readActivePage;
  }
}));

vi.mock("../src/sidepanel/services/ResponsesClient", () => ({
  ResponsesClient: class {
    answer = mocks.answer;
    compressHistory = mocks.compressHistory;
  }
}));

vi.mock("../src/sidepanel/services/SettingsRepository", () => ({
  SettingsRepository: class {
    load = mocks.loadSettings;
    save = vi.fn();
  }
}));

import { useCurioController } from "../src/sidepanel/hooks/useCurioController";

describe("useCurioController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const listeners = {
      addListener: vi.fn(),
      removeListener: vi.fn()
    };
    vi.stubGlobal("chrome", {
      tabs: {
        onActivated: listeners,
        onUpdated: listeners
      }
    });
    mocks.readActivePage.mockResolvedValue({
      tabId: 7,
      page: {
        title: "文档",
        url: "https://example.com/document",
        description: "",
        text: "网页正文",
        capturedAt: "2026-09-03T00:00:00.000Z"
      },
      status: "已读取 4 字符"
    });
    mocks.loadSettings.mockResolvedValue({
      apiUrl: "https://example.com/v1/responses",
      apiKey: "test-key",
      model: "test-model"
    });
    mocks.answer.mockResolvedValue({ content: "回答", reasoning: "" });
    mocks.compressHistory.mockResolvedValue("压缩后的历史摘要");
  });

  it("首问先重新浏览网页再请求模型，后续追问复用快照", async () => {
    const order: string[] = [];
    mocks.readActivePage.mockImplementation(async () => {
      order.push("read");
      return {
        tabId: 7,
        page: {
          title: "文档",
          url: "https://example.com/document",
          description: "",
          text: "网页正文",
          capturedAt: "2026-09-03T00:00:00.000Z"
        },
        status: "已读取 4 字符"
      };
    });
    mocks.answer.mockImplementation(async () => {
      order.push("answer");
      return { content: "回答", reasoning: "" };
    });

    const { result } = renderHook(() => useCurioController());
    await waitFor(() => expect(result.current.page).not.toBeNull());
    expect(mocks.readActivePage).toHaveBeenNthCalledWith(1);
    order.length = 0;

    const onAccepted = vi.fn(() => order.push("accepted"));
    await act(async () => {
      expect(await result.current.submitQuestion("第一个问题", onAccepted)).toBe(true);
    });
    expect(order).toEqual(["accepted", "read", "answer"]);
    expect(mocks.readActivePage).toHaveBeenLastCalledWith({ scanVirtualPages: true });
    expect(result.current.messages.map((message) => message.kind)).toEqual([
      undefined,
      "page-read",
      "answer"
    ]);
    expect(result.current.messages[1].content).toBe("网页正文");

    await act(async () => result.current.refreshPage());
    expect(mocks.readActivePage).toHaveBeenLastCalledWith();

    order.length = 0;
    await act(async () => {
      expect(await result.current.submitQuestion("追问")).toBe(true);
    });
    expect(order).toEqual(["answer"]);
  });

  it("接近 1M 上限时压缩旧上下文，同时保留完整聊天记录", async () => {
    const longAnswer = "长".repeat(950_000);
    mocks.answer
      .mockResolvedValueOnce({ content: longAnswer, reasoning: "" })
      .mockResolvedValueOnce({ content: "压缩后继续回答", reasoning: "" });

    const { result } = renderHook(() => useCurioController());
    await waitFor(() => expect(result.current.page).not.toBeNull());

    await act(async () => {
      expect(await result.current.submitQuestion("第一个问题")).toBe(true);
      expect(await result.current.submitQuestion("继续追问")).toBe(true);
    });

    expect(mocks.compressHistory).toHaveBeenCalledTimes(1);
    const compressedHistory = mocks.answer.mock.calls[1]?.[2];
    expect(compressedHistory).toHaveLength(1);
    expect(compressedHistory[0].content).toContain("压缩后的历史摘要");
    expect(result.current.messages.some((message) => message.content === longAnswer)).toBe(true);
    expect(result.current.messages.at(-1)?.content).toBe("压缩后继续回答");
  });

  it("可以中止当前流式回答并保留已生成内容", async () => {
    mocks.answer.mockImplementation((...args: unknown[]) => {
      const onProgress = args[4] as (progress: { content: string; reasoning: string }) => void;
      const signal = args[5] as AbortSignal;
      onProgress({ content: "部分回答", reasoning: "" });
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
    });

    const { result } = renderHook(() => useCurioController());
    await waitFor(() => expect(result.current.page).not.toBeNull());

    let submission: Promise<boolean> | undefined;
    act(() => {
      submission = result.current.submitQuestion("停止测试");
    });
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledTimes(1));
    expect(result.current.sending).toBe(true);

    act(() => result.current.stopGeneration());
    await act(async () => {
      expect(await submission).toBe(true);
    });

    expect(result.current.sending).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.messages.at(-1)).toMatchObject({
      content: "部分回答",
      status: "stopped"
    });
  });
});
