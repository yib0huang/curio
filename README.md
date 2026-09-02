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
npm install
npm run dev
npm run check
npm run build
npm run package
```

- `npm run dev`：启动 Vite/CRXJS 开发构建和文件监听。
- `npm run check`：执行 TypeScript 类型检查以及 Manifest、资源和版本校验。
- `npm run build`：生成可由 Chrome 加载的 `dist/` 目录。
- `npm run package`：构建后生成 `release/curio-<version>.zip` 发布包。

## 本地安装

1. 执行 `npm install` 和 `npm run build`。
2. 打开 `chrome://extensions/`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择本项目的 `dist/` 目录。
5. 打开一个普通网页并刷新一次。
6. 点击浏览器工具栏中的 Curio 图标，侧边栏会在网页右侧打开。
7. 点击侧边栏右上角的设置按钮，填写 API Key、模型和 API 地址。

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
├── manifest.json                 # Chrome Manifest V3 源清单
├── src/
│   ├── background/
│   │   └── service-worker.ts     # Side Panel 后台行为
│   ├── content/
│   │   └── page-reader.ts        # 当前网页正文提取
│   ├── shared/
│   │   └── types.ts              # 跨运行上下文领域类型
│   └── sidepanel/
│       ├── components/           # React 展示组件
│       ├── hooks/                # React 状态协调层
│       ├── services/             # Chrome、会话、设置和模型服务
│       ├── App.tsx               # 页面组件组合
│       ├── main.tsx              # React 入口
│       ├── index.html            # 侧边栏页面
│       └── index.css             # 侧边栏样式
├── assets/                       # Logo 和 Chrome 多尺寸图标
├── scripts/                      # 校验与发布打包脚本
├── docs/                         # 架构、规范和隐私文档
├── .github/                      # CI 与 Pull Request 模板
├── vite.config.ts                # Vite 与 CRXJS 构建配置
├── tsconfig.json                 # TypeScript 严格模式配置
├── AGENTS.md                     # AI 代理协作约定
└── README.md                     # 项目入口
```

源码使用 React + TypeScript，并按 Chrome 运行上下文和业务职责拆分。Chrome 实际加载的是 Vite/CRXJS 输出到 `dist/` 的标准 Manifest、HTML、CSS 和 JavaScript。

## 项目状态

Curio 当前处于 `0.1.0` 本地 MVP 阶段，尚未建立稳定 API 或公开发布承诺。
