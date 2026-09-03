// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoHideScrollbars } from "../src/sidepanel/hooks/useAutoHideScrollbars";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("useAutoHideScrollbars", () => {
  it("滚动时显示并在停止 700ms 后隐藏滚动条", () => {
    vi.useFakeTimers();
    const scrollArea = document.createElement("div");
    document.body.append(scrollArea);
    const view = renderHook(() => useAutoHideScrollbars());

    scrollArea.dispatchEvent(new Event("scroll"));
    expect(scrollArea.classList.contains("is-scrolling")).toBe(true);

    act(() => vi.advanceTimersByTime(699));
    expect(scrollArea.classList.contains("is-scrolling")).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(scrollArea.classList.contains("is-scrolling")).toBe(false);

    view.unmount();
  });

  it("连续滚动会重新计算隐藏时间", () => {
    vi.useFakeTimers();
    const scrollArea = document.createElement("div");
    document.body.append(scrollArea);
    renderHook(() => useAutoHideScrollbars());

    scrollArea.dispatchEvent(new Event("scroll"));
    act(() => vi.advanceTimersByTime(500));
    scrollArea.dispatchEvent(new Event("scroll"));
    act(() => vi.advanceTimersByTime(500));
    expect(scrollArea.classList.contains("is-scrolling")).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(scrollArea.classList.contains("is-scrolling")).toBe(false);
  });
});
