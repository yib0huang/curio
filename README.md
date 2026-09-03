# Curio

Curio 是一个 Chrome Side Panel 扩展：读取当前标签页的正文，并基于这些内容进行多轮问答。

## 功能特性

- 在任意普通网页旁打开原生 Chrome 侧边栏。
- 汇总当前网页及可访问 iframe 的已加载内容，穿透开放 Shadow DOM，并生成 Markdown 风格结构化正文。
- 保留文章、管理后台、日志、HTML/ARIA 表格、SVG 文档文字、列表、代码和控件名称；结构化提取异常时自动回退到完整可见文本。
- 一键复制当前已提取的正文，方便检查读取结果。
- 每个标签页会话的首次提问会先显示独立的“正在读取网页…”记录，可展开查看读取内容；虚拟分页采集完成后另起一行思考并请求模型。后续追问复用该快照，标签页切换只做静态读取，不触发滚动。
- 围绕网页上下文进行按标签页隔离的多轮对话。
- 流式展示模型回答，并将模型提供的思考摘要默认折叠在最终回答上方。
- 输入框内提供 1M 上下文占用圆环，展开后按系统提示、网页上下文、完整有效对话和当前草稿展示下一轮预计发送的 input token 分布；接近上限时自动压缩旧对话并继续多轮问答。回答复制按钮仅在生成完成后出现。
- 使用安全的 Markdown 排版展示标题、列表、引用、代码和表格等回答内容。
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

项目提供 Makefile 作为统一任务入口；它复用 `package.json` 和 `scripts/` 中的现有实现，不引入额外依赖：

```bash
make help
make install
make check
make build
make package
```

- `make help`：列出全部目标、用途和可覆盖变量。
- `make doctor`：检查 Node.js、npm、`zip` 和 `unzip` 环境。
- `make dev`：启动 Vite/CRXJS 开发构建和文件监听。
- `make check`：执行 TypeScript 类型检查、自动化测试以及 Manifest、资源和版本校验。
- `make build`：完成检查并生成可由 Chrome 加载的 `dist/` 目录。
- `make package`：构建 `release/curio-<version>.zip`，校验归档完整性和根级 Manifest，并输出文件清单。
- `make ci`：按锁文件安装依赖，并执行 CI 所需的检查、构建和打包。

不使用 Make 时，等价的 npm 命令仍然可用：

```bash
npm install
npm run dev
npm test
npm run check
npm run build
npm run package
```

- `npm run dev`：等价于 `make dev`。
- `npm test`：运行流式协议、计时交互和会话隔离自动化测试。
- `npm run check`：等价于 `make check`。
- `npm run build`：等价于 `make build`。
- `npm run package`：完成构建并生成发布包；`make package` 会额外列出 ZIP 内容。

## 本地安装

1. 执行 `make install` 和 `make build`（也可使用对应 npm 命令）。
2. 打开 `chrome://extensions/`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择本项目的 `dist/` 目录。
5. 打开一个普通网页并刷新一次。
6. 点击浏览器工具栏中的 Curio 图标，侧边栏会在网页右侧打开。
7. 点击侧边栏右上角的设置按钮，填写 API Key、模型和 API 地址。

默认 API 地址为 OpenAI Responses API：`https://api.openai.com/v1/responses`，默认模型为 `gpt-5.6-sol`。请求会设置 `store: false`。扩展会持续携带完整对话上下文；接近 1M token 窗口上限时，先生成旧对话摘要，再以摘要和后续新对话继续请求。

当前实现适合本地原型验证。若要发布给其他用户，请改为由自己的后端代理模型请求，不要把服务端 API Key 分发到扩展中。

## 数据与权限

- `sidePanel`：在当前网页旁展示 Curio。
- `tabs` / `activeTab`：识别当前标签页和页面切换。
- `webNavigation`：枚举当前标签页的 frame，以便逐个读取并汇总嵌入区域。
- `<all_urls>`：让内容脚本能读取用户打开的普通网页，并支持请求用户配置的 API 地址。
- `storage`：在浏览器本地保存 API 设置。

页面正文最多提取 120,000 个字符，达到上限时界面会显示截断标记。WPS 一类虚拟分页文档只会在当前标签页会话的首次提问时有界滚动内部工作区，等待各页 SVG 文本加载稳定后收集并恢复原位置。浏览器内部页面（如 `chrome://`）、Chrome Web Store 及其他受保护页面无法由扩展读取；关闭的 Shadow DOM、Canvas 内文字以及普通虚拟列表尚未渲染的数据仍可能无法读取。

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
