// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownContent } from "../src/sidepanel/components/MarkdownContent";

afterEach(cleanup);

describe("MarkdownContent", () => {
  it("渲染常见 Markdown 和 GFM 结构", () => {
    const { container } = render(
      <MarkdownContent>{`## 标题

**重点**和\`代码\`

- 第一项
- 第二项

| 名称 | 值 |
| --- | --- |
| 状态 | 正常 |`}</MarkdownContent>
    );

    expect(container.querySelector("h2")?.textContent).toBe("标题");
    expect(container.querySelector("strong")?.textContent).toBe("重点");
    expect(container.querySelector("code")?.textContent).toBe("代码");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("table")?.textContent).toContain("状态");
  });

  it("流式 Markdown 尚未闭合时可渲染，补全后更新语义", () => {
    const view = render(<MarkdownContent>**正在输出</MarkdownContent>);
    expect(view.container.querySelector("strong")).toBeNull();
    expect(view.container.textContent).toContain("**正在输出");

    view.rerender(<MarkdownContent>**正在输出**</MarkdownContent>);
    expect(view.container.querySelector("strong")?.textContent).toBe("正在输出");
  });

  it("禁用原始 HTML、远程图片和危险链接", () => {
    const { container } = render(
      <MarkdownContent>{`<script>alert(1)</script>

![跟踪图片](https://tracker.invalid/pixel.png)

[危险链接](javascript:alert(1))

[安全链接](https://example.com)`}</MarkdownContent>
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    const links = container.querySelectorAll("a");
    expect(links[0]?.getAttribute("href")).toBe("");
    expect(links[1]?.getAttribute("href")).toBe("https://example.com");
    expect(links[1]?.getAttribute("target")).toBe("_blank");
    expect(links[1]?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
