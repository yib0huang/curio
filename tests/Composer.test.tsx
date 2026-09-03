// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
        messages={[]}
        pageStatus="已读取 12,404 字符"
        error=""
        sending={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onStop={vi.fn()}
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

  it("在输入框内展示下一轮 input token 的组成，并随草稿更新", () => {
    render(
      <Composer
        page={{
          title: "测试文档",
          url: "https://example.com",
          description: "页面描述",
          text: "网页正文",
          capturedAt: "2026-09-03T00:00:00.000Z"
        }}
        messages={[
          { role: "user", content: "上一问" },
          { role: "assistant", content: "上一答", status: "complete" }
        ]}
        pageStatus="已读取"
        error=""
        sending={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onStop={vi.fn()}
        onSubmit={vi.fn(async () => true)}
      />
    );

    const trigger = screen.getByLabelText(/查看上下文使用情况/);
    expect(trigger.closest("form")?.classList.contains("composer")).toBe(true);
    expect(trigger.querySelectorAll("circle")).toHaveLength(2);
    fireEvent.click(trigger);
    expect(screen.getByText("上下文使用情况")).toBeTruthy();
    expect(screen.getByText(/约 .* \/ 1M tokens/)).toBeTruthy();
    expect(screen.queryByText(/下一轮预计发送/)).toBeNull();
    expect(screen.queryByText(/按当前草稿估算/)).toBeNull();
    expect(screen.getByText("系统提示")).toBeTruthy();
    expect(screen.getByText("网页上下文")).toBeTruthy();
    expect(screen.getByText("对话历史")).toBeTruthy();
    expect(screen.getByText("当前输入")).toBeTruthy();
    expect(screen.queryByText(/输出|推理/)).toBeNull();

    const totalBefore = screen.getByText(/约 .* \/ 1M tokens/).textContent;
    fireEvent.change(screen.getByLabelText("问题"), {
      target: { value: "请详细概括这一页的主要内容" }
    });
    expect(screen.getByText(/约 .* \/ 1M tokens/).textContent).not.toBe(totalBefore);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "上下文使用情况" })).toBeNull();
  });

  it("请求受理后立即清空输入框，请求失败时恢复原问题", async () => {
    let finishRequest: ((succeeded: boolean) => void) | undefined;
    const onSubmit = vi.fn(
      (_question: string, onAccepted?: () => void) => {
        onAccepted?.();
        return new Promise<boolean>((resolve) => {
          finishRequest = resolve;
        });
      }
    );
    render(
      <Composer
        page={null}
        messages={[]}
        pageStatus="已读取"
        error=""
        sending={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onStop={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByLabelText("问题") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "需要重试的问题" } });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(onSubmit).toHaveBeenCalledWith("需要重试的问题", expect.any(Function));
    expect(textarea.value).toBe("");

    await act(async () => finishRequest?.(false));
    expect(textarea.value).toBe("需要重试的问题");
  });

  it("生成期间把发送按钮切换为停止按钮", () => {
    const onStop = vi.fn();
    render(
      <Composer
        page={null}
        messages={[]}
        pageStatus="已读取"
        error=""
        sending
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onStop={onStop}
        onSubmit={vi.fn(async () => true)}
      />
    );

    expect((screen.getByLabelText("问题") as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("停止生成"));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("发送")).toBeNull();
  });
});
