# Curio

Curio 是一个 Chrome Side Panel 扩展：读取当前标签页的正文，并基于这些内容进行多轮问答。

## 功能特性

- 在任意普通网页旁打开原生 Chrome 侧边栏。
- 提取当前网页标题、URL、描述和主要正文。
- 围绕网页上下文进行按标签页隔离的多轮对话。
- 支持配置 Responses API 地址、API Key 和模型。
- 对网页提示词注入、输出渲染和请求存储采取基础防护。

## 文档

- [AI 代理协作约定](AGENTS.md)
- [贡献指南](CONTRIBUTING.md)
- [架构说明](docs/ARCHITECTURE.md)
- [开发与发布](docs/DEVELOPMENT.md)
- [代码与中文注释规范](docs/CODE_STYLE.md)
- [Git 分支管理](docs/GIT_WORKFLOW.md)
- [隐私与数据处理](docs/PRIVACY.md)
- [安全策略](SECURITY.md)
- [版本记录](CHANGELOG.md)

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

```text
curio/
├── manifest.json                 # Chrome Manifest V3 入口
├── src/
│   ├── background/
│   │   └── service-worker.js     # Side Panel 后台行为
│   ├── content/
│   │   └── page-reader.js        # 当前网页正文提取
│   └── sidepanel/
│       ├── index.html            # 侧边栏页面
│       ├── index.css             # 侧边栏样式
│       └── index.js              # 会话状态与模型请求
├── assets/                       # Logo 和 Chrome 多尺寸图标
├── scripts/                      # 校验与发布打包脚本
├── docs/                         # 架构、规范和隐私文档
├── .github/                      # CI 与 Pull Request 模板
├── AGENTS.md                     # AI 代理协作约定
└── README.md                     # 项目入口
```

该结构遵循 Manifest 位于扩展根目录、源代码按 Chrome 运行上下文拆分、工程文件与运行资源分离的组织原则。

## 项目状态

Curio 当前处于 `0.1.0` 本地 MVP 阶段，尚未建立稳定 API 或公开发布承诺。
