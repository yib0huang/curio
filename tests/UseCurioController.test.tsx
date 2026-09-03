// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
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

    await act(async () => {
      expect(await result.current.submitQuestion("第一个问题")).toBe(true);
    });
    expect(order).toEqual(["read", "answer"]);
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
});
