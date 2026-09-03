// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildResponseInput,
  estimateNextInputUsage
} from "../src/sidepanel/services/PromptContext";

const page = {
  title: "测试",
  url: "https://example.com",
  description: "描述",
  text: "网页正文",
  capturedAt: ""
};

describe("PromptContext", () => {
  it("发送与预览都只采用最近 6 轮真实对话", () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `消息${index}`
    }));
    history.splice(4, 0, {
      role: "assistant",
      content: "网页读取记录",
      kind: "page-read"
    } as typeof history[number] & { kind: "page-read" });

    const input = buildResponseInput(page, history, "新问题");
    expect(input).toHaveLength(15);
    expect(input.map((message) => message.content).join("\n")).not.toContain("网页读取记录");
    expect(input.map((message) => message.content)).not.toContain("消息0");
    expect(input.at(-1)).toEqual({ role: "user", content: "新问题" });
  });

  it("只统计下一轮 input 的四类来源，并随当前草稿增加", () => {
    const history = [
      { role: "user" as const, content: "上一问" },
      { role: "assistant" as const, content: "上一答" }
    ];
    const emptyDraft = estimateNextInputUsage(page, history, "");
    const withDraft = estimateNextInputUsage(page, history, "继续详细说明这个问题");

    expect(withDraft.segments.map((segment) => segment.label)).toEqual([
      "系统提示",
      "网页上下文",
      "对话历史（最近 6 轮）",
      "当前输入"
    ]);
    expect(emptyDraft.segments.at(-1)?.tokens).toBe(0);
    expect(withDraft.segments.at(-1)?.tokens).toBeGreaterThan(0);
    expect(withDraft.totalTokens).toBeGreaterThan(emptyDraft.totalTokens);
    expect(withDraft.totalTokens).toBe(
      withDraft.segments.reduce((total, segment) => total + segment.tokens, 0)
    );
  });
});
