import { useEffect } from "react";

const SCROLLBAR_IDLE_DELAY = 700;

/**
 * 在任意滚动区域活动时显示滚动条，停止滚动后自动隐藏。
 * 使用捕获阶段监听可覆盖消息区、网页快照、代码块、表格和输入框。
 */
export function useAutoHideScrollbars(): void {
  useEffect(() => {
    const timers = new Map<Element, number>();
    const handleScroll = (event: Event) => {
      const target = event.target instanceof Element
        ? event.target
        : document.scrollingElement;
      if (!target) return;

      target.classList.add("is-scrolling");
      const previousTimer = timers.get(target);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      const timer = window.setTimeout(() => {
        target.classList.remove("is-scrolling");
        timers.delete(target);
      }, SCROLLBAR_IDLE_DELAY);
      timers.set(target, timer);
    };

    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      for (const [element, timer] of timers) {
        window.clearTimeout(timer);
        element.classList.remove("is-scrolling");
      }
    };
  }, []);
}
