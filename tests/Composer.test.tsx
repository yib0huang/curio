// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "../src/sidepanel/components/Composer";

afterEach(cleanup);

describe("Composer", () => {
  it("底部页面信息不再显示字数和正文复制按钮", () => {
    render(
      <Composer
        page={{
          title: "测试文档",
          url: "https://example.com",
          description: "",
          text: "正文".repeat(6202),
          capturedAt: "2026-09-03T00:00:00.000Z"
        }}
        pageStatus="已读取 12,404 字符"
        error=""
        disabled={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={vi.fn(async () => true)}
      />
    );

    expect(screen.getByText("测试文档")).toBeTruthy();
    expect(screen.queryByText("12,404")).toBeNull();
    expect(screen.queryByLabelText(/复制.*正文/)).toBeNull();
    expect(screen.getByPlaceholderText("关于这个页面，想问什么？")).toBeTruthy();
    const sendButton = screen.getByLabelText("发送") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("问题"), { target: { value: "请概括" } });
    expect(sendButton.disabled).toBe(false);
  });
});
