# 架构说明

## 系统边界

Curio 是一个使用 React、TypeScript、Vite 和 CRXJS 构建的纯客户端 Chrome Manifest V3 扩展。当前版本没有自有后端，模型请求从扩展侧边栏直接发送到用户配置的 Responses API 地址。Chrome 加载的是 `dist/` 内构建后的标准 Web 资源。

## 组件

### Manifest

`manifest.json` 声明扩展权限、后台 Service Worker、内容脚本、Side Panel 页面和图标资源，是所有运行时入口的唯一注册点。

### Background Service Worker

`src/background/service-worker.ts` 配置点击扩展工具栏图标时打开 Side Panel。它不读取网页、不保存对话，也不调用模型。

### Content Script

`src/content/page-reader.ts` 在普通网页及其可访问 frame 加载完成后注入。收到 `CURIO_READ_PAGE` 消息时，它调用 `page-extractor.ts`：

1. 从完整 `body` 遍历当前已加载 DOM，不再因为短小的 `main` 节点丢弃页面其他区域。
2. 递归读取开放 Shadow DOM 和 slot 的实际分配内容。
3. 移除脚本、样式、显式隐藏元素和嵌入对象，但保留导航、状态、工具栏、标签页等应用页面信息。
4. 将标题、列表、引用、代码块、HTML 表格、ARIA table/grid 和 SVG `text`/`tspan` 文档转换为 Markdown 风格正文。
5. 保留控件的无障碍名称，但不读取输入框值、文本域内容或可编辑区草稿。
6. 使用浏览器完整可见文本交叉检查；结构化结果异常短时自动降级。
7. 返回标题、URL、描述、正文、Shadow DOM 数量、原始字符数和截断状态。

检测到 `svg.text-page` 或 `.canvas-unit svg` 虚拟分页文档时，提取器会有界滚动最近的内部滚动容器，按声明页数或实际页高选择扫描位置，并等待 SVG 正文发生变化且连续稳定后再继续，单页最多等待 3 秒，随后恢复原滚动位置。扫描最多访问 100 页或运行 90 秒，不对普通网页和无限信息流执行自动滚动。

`ChromePageService` 使用 `webNavigation` 枚举当前标签页的 frame，按 `frameId` 分别读取并按父子层级汇总。重复 frame 内容会被去重，无法访问的区域会形成可见提示，最终上下文限制为 120,000 个字符。

每个标签页会话发送第一条问题时，控制器先创建独立的网页读取消息并显示“正在读取网页…”，用户可以展开查看当前已有快照；完整采集结束后该消息固化最终读取内容，再另起一条助手消息开始模型思考和回答。网页读取消息是纯 UI 记录，不会作为对话历史重复发送给模型。该会话的后续问题复用已采集快照；侧栏打开、页面刷新和标签页切换只执行静态 DOM 提取，不触发文档滚动。

内容脚本不会主动发送网页数据。

### Side Panel

Side Panel 使用分层的 React + TypeScript 结构：

- `components/`：展示页面、消息、输入框和设置对话框。
- `components/MarkdownContent.tsx`：安全渲染模型 Markdown，禁用原始 HTML 和远程图片。
- `hooks/useCurioController.ts`：组合 UI 状态和业务流程，不实现具体协议。
- `services/ChromePageService.ts`：活动标签页和内容脚本通信。
- `services/ConversationStore.ts`：按 `tabId` 隔离内存会话。
- `services/SettingsRepository.ts`：封装 `chrome.storage.local`。
- `services/ResponsesClient.ts`：封装不可信网页上下文和 Responses API SSE 协议，分离推理摘要与最终输出事件。
- `shared/types.ts`：Content Script 与 Side Panel 共享的消息及领域类型。

## 数据流

```text
当前网页
  │ CURIO_READ_PAGE
  ▼
page-reader.ts ──页面快照──▶ ChromePageService
                                  │
                                  ▼
                         useCurioController
                          │       │       │
                          │       │       └──▶ React Components
                          │       └──▶ SettingsRepository
                          └──▶ ConversationStore
                                  │
                                  └──问题 + 上下文──▶ ResponsesClient ──▶ 模型 API
```

## 状态生命周期

- 页面快照：保存在 Side Panel 页面内存中，切换或刷新标签页时更新。
- 对话历史：保存在 Side Panel 页面内存的 `Map<tabId, messages>` 中；流式生成期间持续更新当前助手消息，关闭 Side Panel 后不保证保留。
- API 设置：保存在 `chrome.storage.local` 中，直到用户修改或清除扩展数据。

## 已知架构限制

- SPA 页面内容变化不会始终自动触发重新提取，用户可手动刷新页面快照。
- 普通虚拟列表仍只能读取当前已渲染到 DOM 的行；纯 Canvas、关闭的 Shadow DOM 和浏览器保护页面没有可靠的纯文本读取路径。
- 纯客户端 API Key 不适合面向公众发布。
- 当前正文提取是通用启发式实现，不等同于完整 Readability 算法。
- 会话没有跨浏览器重启持久化。
