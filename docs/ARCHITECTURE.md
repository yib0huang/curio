# 架构说明

## 系统边界

Curio 是一个使用 React、TypeScript、Vite 和 CRXJS 构建的纯客户端 Chrome Manifest V3 扩展。当前版本没有自有后端，模型请求从扩展侧边栏直接发送到用户配置的 Responses API 地址。Chrome 加载的是 `dist/` 内构建后的标准 Web 资源。

## 组件

### Manifest

`manifest.json` 声明扩展权限、后台 Service Worker、内容脚本、Side Panel 页面和图标资源，是所有运行时入口的唯一注册点。

### Background Service Worker

`src/background/service-worker.ts` 配置点击扩展工具栏图标时打开 Side Panel。它不读取网页、不保存对话，也不调用模型。

### Content Script

`src/content/page-reader.ts` 在普通网页加载完成后注入。收到 `CURIO_READ_PAGE` 消息时，它会：

1. 收集 `article`、`main` 和 `[role="main"]` 作为正文候选。
2. 优先采用内容足够完整的语义化 `article`，否则选择最长的 `main` 或 `[role="main"]`。
3. 复制 DOM，移除脚本、样式、导航、侧栏、表单、菜单、工具栏及不可见元素。
4. 将标题、段落、列表、引用、代码块和表格转换为 Markdown 风格正文。
5. 清理空白与编码占位，并将正文限制在 50,000 个字符。
6. 返回标题、URL、页面描述、正文和采集时间。

内容脚本不会主动发送网页数据。

### Side Panel

Side Panel 使用分层的 React + TypeScript 结构：

- `components/`：展示页面、消息、输入框和设置对话框。
- `hooks/useCurioController.ts`：组合 UI 状态和业务流程，不实现具体协议。
- `services/ChromePageService.ts`：活动标签页和内容脚本通信。
- `services/ConversationStore.ts`：按 `tabId` 隔离内存会话。
- `services/SettingsRepository.ts`：封装 `chrome.storage.local`。
- `services/ResponsesClient.ts`：封装不可信网页上下文和 Responses API 协议。
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
- 对话历史：保存在 Side Panel 页面内存的 `Map<tabId, messages>` 中；关闭 Side Panel 后不保证保留。
- API 设置：保存在 `chrome.storage.local` 中，直到用户修改或清除扩展数据。

## 已知架构限制

- SPA 页面内容变化不会始终自动触发重新提取，用户可手动刷新页面快照。
- 纯客户端 API Key 不适合面向公众发布。
- 当前正文提取是通用启发式实现，不等同于完整 Readability 算法。
- 会话没有跨浏览器重启持久化，也没有流式输出。
