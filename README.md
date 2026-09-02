# Curio

Curio 是一个 Chrome Side Panel 扩展：读取当前标签页的正文，并基于这些内容进行多轮问答。

## 工程命令

```bash
npm run check
npm run package
```

- `npm run check`：校验 Manifest 引用的资源和 JavaScript 语法。
- `npm run package`：校验通过后生成可发布的 `dist/curio-<version>.zip`。

## 本地安装

1. 打开 `chrome://extensions/`。
2. 开启右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本目录。
4. 打开一个普通网页并刷新一次。
5. 点击浏览器工具栏中的 Curio 图标，侧边栏会在网页右侧打开。
6. 点击侧边栏右上角的设置按钮，填写 API Key、模型和 API 地址。

默认 API 地址为 OpenAI Responses API：`https://api.openai.com/v1/responses`，默认模型为 `gpt-5.6-sol`。请求会设置 `store: false`，扩展每次最多携带最近 6 轮对话。

当前实现适合本地原型验证。若要发布给其他用户，请改为由自己的后端代理模型请求，不要把服务端 API Key 分发到扩展中。

## 数据与权限

- `sidePanel`：在当前网页旁展示 Curio。
- `tabs` / `activeTab`：识别当前标签页和页面切换。
- `<all_urls>`：让内容脚本能读取用户打开的普通网页，并支持请求用户配置的 API 地址。
- `storage`：在浏览器本地保存 API 设置。

页面正文最多提取 50,000 个字符。浏览器内部页面（如 `chrome://`）、Chrome Web Store 及其他受保护页面无法由扩展读取。

## 项目结构

- `manifest.json`：Manifest V3 配置。
- `background.js`：点击扩展图标时打开侧边栏。
- `content.js`：提取当前页面的标题、URL、描述和正文。
- `sidepanel.html/css/js`：对话界面、逐标签页会话状态与模型请求。
- `assets/curio-logo-v3.png`：当前使用的放大版透明 Logo 原图。
- `assets/icons-v3/`：Chrome 当前使用的 16、32、48、128px 图标。
- `assets/curio-logo.png`、`assets/curio-logo-v2.png`：保留的早期版本。
