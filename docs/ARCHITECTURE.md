# 架构说明

## 系统边界

Curio 是一个纯客户端 Chrome Manifest V3 扩展。当前版本没有自有后端，模型请求从扩展侧边栏直接发送到用户配置的 Responses API 地址。

## 组件

### Manifest

`manifest.json` 声明扩展权限、后台 Service Worker、内容脚本、Side Panel 页面和图标资源，是所有运行时入口的唯一注册点。

### Background Service Worker

`src/background/service-worker.js` 配置点击扩展工具栏图标时打开 Side Panel。它不读取网页、不保存对话，也不调用模型。

### Content Script

`src/content/page-reader.js` 在普通网页加载完成后注入。收到 `CURIO_READ_PAGE` 消息时，它会：

1. 优先选择 `main`、`article` 或 `[role="main"]`。
2. 复制 DOM，移除脚本、样式、导航、表单及不可见元素。
3. 清理空白并将正文限制在 50,000 个字符。
4. 返回标题、URL、页面描述、正文和采集时间。

内容脚本不会主动发送网页数据。

### Side Panel

`src/sidepanel/index.js` 是当前应用控制器，负责：

- 查询活动标签页并向内容脚本请求页面快照。
- 在内存中按 `tabId` 保存对话历史。
- 从 `chrome.storage.local` 读取模型配置。
- 拼装不可信网页上下文和最近 6 轮对话。
- 调用模型 API 并以纯文本渲染结果。

## 数据流

```text
当前网页
  │ CURIO_READ_PAGE
  ▼
page-reader.js ──页面快照──▶ sidepanel/index.js
                            │
                            ├──▶ UI（标题、状态、对话）
                            │
                            ├──▶ chrome.storage.local（API 配置）
                            │
                            └──问题 + 页面快照──▶ 模型 API
                                                   │
                                                   └──回答──▶ UI
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
