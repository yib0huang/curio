// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageList, formatElapsedTime } from "../src/sidepanel/components/MessageList";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MessageList", () => {
  it("按 Codex 文案格式化秒数和分钟", () => {
    expect(formatElapsedTime(0)).toBe("0秒");
    expect(formatElapsedTime(34)).toBe("34秒");
    expect(formatElapsedTime(519)).toBe("8分钟 39秒");
  });

  it("默认收起思考内容并实时显示已处理时长", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const startedAt = Date.now();
    const view = render(
      <MessageList
        messages={[
          {
            role: "assistant",
            content: "",
            reasoning: "正在检查页面结构",
            status: "streaming",
            startedAt
          }
        ]}
      />
    );

    const details = document.querySelector("details");
    expect(details?.open).toBe(false);
    expect(screen.getByText("思考中…")).toBeTruthy();

    act(() => vi.advanceTimersByTime(34_000));
    expect(screen.getByText("已处理 34秒")).toBeTruthy();

    const summary = screen.getByText("已处理 34秒");
    fireEvent.click(summary);
    expect(details?.open).toBe(true);

    view.rerender(
      <MessageList
        messages={[
          {
            role: "assistant",
            content: "流式回答",
            reasoning: "正在检查页面结构",
            status: "streaming",
            startedAt
          }
        ]}
      />
    );
    expect(details?.open).toBe(true);
    expect(details?.contains(screen.getByText("流式回答"))).toBe(false);
  });

  it("把网页读取结果作为独立消息展开显示", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(
      <MessageList
        messages={[
          {
            role: "assistant",
            kind: "page-read",
            content: "第一页正文\n第二页正文",
            status: "complete",
            startedAt: Date.now()
          }
        ]}
      />
    );

    const summary = screen.getByText("网页内容已读取");
    expect(screen.getByText("11 字符")).toBeTruthy();
    expect(screen.queryByText(/第一页正文/)).toBeTruthy();
    expect(document.querySelector("details")?.open).toBe(false);
    fireEvent.click(summary);
    expect(document.querySelector("details")?.open).toBe(true);
    await act(async () => fireEvent.click(screen.getByLabelText("复制网页内容")));
    expect(writeText).toHaveBeenCalledWith("第一页正文\n第二页正文");
    expect(screen.getByLabelText("已复制")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByLabelText("复制网页内容")).toBeTruthy();
  });

  it("可以复制单条模型回答", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(
      <MessageList
        messages={[{ role: "assistant", content: "单条回答", status: "complete" }]}
      />
    );

    await act(async () => fireEvent.click(screen.getByLabelText("复制回答")));
    expect(writeText).toHaveBeenCalledWith("单条回答");
    expect(screen.getByLabelText("回答已复制")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_999));
    expect(screen.getByLabelText("回答已复制")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText("复制回答")).toBeTruthy();
  });

  it("完成后冻结总用时且保持默认收起", () => {
    render(
      <MessageList
        messages={[
          {
            role: "assistant",
            content: "最终回答",
            reasoning: "思考摘要",
            status: "complete",
            elapsedSeconds: 519
          }
        ]}
      />
    );

    expect(screen.getByText("用时 8分钟 39秒")).toBeTruthy();
    expect(document.querySelector("details")?.open).toBe(false);
    expect(document.querySelector("details")?.contains(screen.getByText("最终回答"))).toBe(
      false
    );
  });

  it("模型没有思考摘要时仍保留完成用时", () => {
    render(
      <MessageList
        messages={[
          {
            role: "assistant",
            content: "直接回答",
            status: "complete",
            elapsedSeconds: 12
          }
        ]}
      />
    );

    expect(screen.getByText("用时 12秒")).toBeTruthy();
    expect(document.querySelector("details")).toBeNull();
  });
});
