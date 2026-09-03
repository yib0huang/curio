// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  extractFrame,
  extractFrameWithVirtualPages,
  MAX_PAGE_CHARS
} from "../src/content/page-extractor";

describe("extractFrame", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>测试页面</title>";
    document.body.innerHTML = "";
  });

  it("不会因为页面存在很短的 main 而丢弃其他可见内容", () => {
    document.body.innerHTML = `
      <main>当前页面</main>
      <section>
        <h2>应用日志</h2>
        <div role="status">查询完成，共 82414 条</div>
        <div role="toolbar">最近 30 分钟 查询</div>
        <p>RequestFsyncUploadFile failed: permission denied</p>
      </section>
    `;

    const page = extractFrame(document, "https://example.com/logs");

    expect(page.text).toContain("当前页面");
    expect(page.text).toContain("应用日志");
    expect(page.text).toContain("82414 条");
    expect(page.text).toContain("permission denied");
  });

  it("过滤显式隐藏内容但保留无障碍状态文本", () => {
    document.body.innerHTML = `
      <style>.hidden-by-css { display: none; }</style>
      <p hidden>隐藏一</p>
      <p aria-hidden="true">隐藏二</p>
      <p class="hidden-by-css">隐藏三</p>
      <div role="status" aria-live="polite">任务已完成</div>
    `;

    const page = extractFrame(document, "https://example.com/status");

    expect(page.text).toContain("任务已完成");
    expect(page.text).not.toContain("隐藏一");
    expect(page.text).not.toContain("隐藏二");
    expect(page.text).not.toContain("隐藏三");
  });

  it("把 HTML 表格和 ARIA grid 转换为 Markdown", () => {
    document.body.innerHTML = `
      <table><tr><th>时间</th><th>消息</th></tr><tr><td>10:00</td><td>成功</td></tr></table>
      <div role="grid">
        <div role="row"><span role="columnheader">实例</span><span role="columnheader">状态</span></div>
        <div role="row"><span role="gridcell">api-v7</span><span role="gridcell">运行中</span></div>
      </div>
    `;

    const page = extractFrame(document, "https://example.com/table");

    expect(page.text).toContain("| 时间 | 消息 |");
    expect(page.text).toContain("| 10:00 | 成功 |");
    expect(page.text).toContain("| 实例 | 状态 |");
    expect(page.text).toContain("| api-v7 | 运行中 |");
  });

  it("读取开放 Shadow DOM 及 slot 的实际内容", () => {
    const host = document.createElement("app-shell");
    host.innerHTML = '<span slot="body">插槽日志内容</span>';
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<h2>影子区域</h2><slot name="body"></slot>';
    document.body.append(host);

    const page = extractFrame(document, "https://example.com/shadow");

    expect(page.text).toContain("影子区域");
    expect(page.text).toContain("插槽日志内容");
    expect(page.extraction?.shadowRootCount).toBe(1);
  });

  it("读取 WPS 类 SVG 文档中的 text 和 tspan 正文", () => {
    document.body.innerHTML = `
      <aside>文档大纲</aside>
      <svg class="text-page" viewBox="0 0 794 1123">
        <g id="main">
          <text x="100" y="80">研发族群-开发序列评级材料提交</text>
          <text x="100" y="110"><tspan>P7</tspan><tspan> 评级申请</tspan></text>
          <text x="100" y="150">申请人 王某某</text>
          <text x="100" y="180">注意事项：突出重点</text>
          <text>mmmmmmmmmmlli&#xE061;</text>
        </g>
      </svg>
    `;

    const page = extractFrame(document, "https://example.com/document");

    expect(page.text).toContain("文档大纲");
    expect(page.text).toContain("研发族群-开发序列评级材料提交");
    expect(page.text).toContain("P7 评级申请");
    expect(page.text).toContain("申请人 王某某");
    expect(page.text).toContain("注意事项：突出重点");
    expect(page.text).not.toContain("mmmmmmmmmmlli");
  });

  it("滚动虚拟文档容器并汇总卸载前的各页 SVG 文本", async () => {
    document.body.innerHTML = `
      <div id="page-status">页面 : 1/3</div>
      <div id="workspace" style="height: 500px; overflow-y: scroll">
        <div class="canvas-unit"><svg class="text-page"><text>第1页正文</text></svg></div>
      </div>
    `;
    const workspace = document.getElementById("workspace") as HTMLElement;
    Object.defineProperty(workspace, "clientHeight", { configurable: true, value: 500 });
    Object.defineProperty(workspace, "scrollHeight", { configurable: true, value: 1500 });
    let scrollTop = 0;
    Object.defineProperty(workspace, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
        const pageNumber = value < 400 ? 1 : value < 800 ? 2 : 3;
        window.setTimeout(() => {
          const pageStatus = document.getElementById("page-status");
          if (pageStatus) pageStatus.textContent = `页面 : ${pageNumber}/3`;
          workspace.innerHTML = `
            <div class="canvas-unit">
              <svg class="text-page"><text>第${pageNumber}页正文</text></svg>
            </div>
          `;
        }, 180);
      }
    });

    const page = await extractFrameWithVirtualPages(document, "https://example.com/document");

    expect(page.text).toContain("### 第 1 页");
    expect(page.text).toContain("第1页正文");
    expect(page.text).toContain("第2页正文");
    expect(page.text).toContain("第3页正文");
    expect(page.extraction?.virtualPageCount).toBe(3);
    expect(scrollTop).toBe(0);
  });

  it("保留控件名称但不读取输入值和可编辑草稿", () => {
    document.body.innerHTML = `
      <label for="query">查询条件</label>
      <input id="query" aria-label="日志关键词" value="private token">
      <textarea placeholder="请输入备注">secret draft</textarea>
      <div contenteditable="true" aria-label="富文本编辑器">unfinished message</div>
      <button aria-label="开始查询"></button>
    `;

    const page = extractFrame(document, "https://example.com/form");

    expect(page.text).toContain("查询条件");
    expect(page.text).toContain("日志关键词");
    expect(page.text).toContain("请输入备注");
    expect(page.text).toContain("富文本编辑器");
    expect(page.text).toContain("开始查询");
    expect(page.text).not.toContain("private token");
    expect(page.text).not.toContain("secret draft");
    expect(page.text).not.toContain("unfinished message");
  });

  it("结构化遍历异常短时回退到浏览器完整可见文本", () => {
    document.body.innerHTML = "<p>短内容</p>";
    Object.defineProperty(document.body, "innerText", {
      configurable: true,
      value: `完整可见内容 ${"日志行 ".repeat(100)}`
    });

    const page = extractFrame(document, "https://example.com/fallback");

    expect(page.text).toContain("完整可见内容");
    expect(page.extraction?.mode).toBe("visible-text");
  });

  it("明确标记超长页面被截断", () => {
    document.body.textContent = "长日志".repeat(MAX_PAGE_CHARS);

    const page = extractFrame(document, "https://example.com/large");

    expect(page.text.length).toBe(MAX_PAGE_CHARS);
    expect(page.extraction?.truncated).toBe(true);
    expect(page.extraction?.sourceCharacters).toBeGreaterThan(MAX_PAGE_CHARS);
  });
});
