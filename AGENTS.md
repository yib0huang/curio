# AGENTS.md

本文件定义 AI 编码代理在 Curio 仓库中的工作约定，作用域覆盖整个仓库。若未来子目录存在更具体的 `AGENTS.md`，以距离目标文件最近的规则为准。

## 项目目标

Curio 是一个基于 Chrome Manifest V3 Side Panel API 的网页阅读与对话扩展。它提取当前标签页的可读文本，将网页内容作为不可信上下文提交给模型，并在侧边栏中维持按标签页隔离的多轮会话。

当前前端技术栈为 React、TypeScript、Vite 和 CRXJS。保持运行时依赖克制；引入新依赖前必须说明维护价值、包体影响和许可证。

## 开始工作前

1. 阅读 `README.md` 和与任务相关的 `docs/` 文档。
2. 运行 `git status --short`，保留用户已有修改，不覆盖无关变更。
3. 阅读待修改文件及其直接调用方，确认 Manifest 权限和数据流影响。
4. 若任务涉及权限、隐私或模型请求，同时阅读 `SECURITY.md` 和 `docs/PRIVACY.md`。

## 代码地图

- `manifest.json`：扩展入口、权限、图标及脚本注册。
- `src/background/`：后台 Service Worker，只负责 Side Panel 行为。
- `src/content/`：运行在网页中的内容脚本，提取页面信息。
- `src/sidepanel/components/`：React 展示组件。
- `src/sidepanel/hooks/`：React 状态与业务流程协调。
- `src/sidepanel/services/`：Chrome API、设置、会话与模型协议封装。
- `src/shared/`：不同扩展运行上下文共享的 TypeScript 类型。
- `assets/`：Logo 原图和 Chrome 多尺寸图标。
- `scripts/`：工程校验和发布打包脚本。
- `docs/`：架构、开发和隐私设计文档。

## 实现约定

- 使用 React 函数组件与严格模式 TypeScript；禁止新增无类型的 JavaScript 业务文件。
- Background 和 Content Script 使用 TypeScript，不引入 React 运行时。
- 有状态或外部系统边界可使用类封装；纯数据转换优先使用无副作用函数，避免无意义的面向对象层级。
- React 组件只负责展示和交互组合，不能直接承载模型协议、持久化或复杂 Chrome API 流程。
- 遵守 Manifest V3 CSP：不得添加内联脚本、`eval`、远程执行代码或动态注入第三方脚本。
- UI 文案默认使用简体中文；代码标识符使用清晰的英文名称。
- 项目自有注释统一使用简体中文，并遵循对应语言的原生注释语法。
- TypeScript 的文件职责、复杂函数及输入输出使用 TSDoc/JSDoc 风格；HTML、CSS、Shell 分别使用标准注释格式；JSON 不添加注释。
- 注释解释设计原因、安全边界和非显然约束，不逐行复述代码。完整规范见 `docs/CODE_STYLE.md`。
- 用户可见错误需要可操作，不能只显示底层异常。
- 依赖 React 默认文本转义，不使用 `dangerouslySetInnerHTML` 渲染网页或模型内容。
- 新增资源后同步更新 `manifest.json`、校验脚本和相关文档。
- 不手工修改 `dist/` 或 `release/`；它们分别是构建目录和发布包目录，均被 Git 忽略。

## 安全与隐私边界

- 网页内容始终是不可信输入。不得允许网页文本覆盖系统规则、读取密钥或触发浏览器操作。
- 不得提交 API Key、访问令牌、Cookie、用户网页内容样本或其他敏感数据。
- 不得扩大 Chrome 权限范围，除非功能确实需要，并在 README 与隐私文档中解释用途。
- 当前浏览器本地保存 API Key 的实现仅用于本地原型。面向真实用户发布前，模型调用必须迁移到受控后端。
- 日志中不得记录 API Key、完整网页正文或完整模型请求。

## 验证要求

每次代码修改至少运行：

```bash
npm run check
```

涉及 Manifest、资源或发布结构时额外运行：

```bash
npm run package
unzip -l release/curio-<version>.zip
```

涉及交互时，需在 Chrome 中手动验证：

1. 点击工具栏图标可打开侧边栏。
2. 普通 `http`/`https` 页面可读取，受保护页面显示可理解的提示。
3. 切换标签页后页面信息和会话互不串联。
4. 设置保存、发送、失败重试和多轮追问工作正常。
5. 浅色与深色模式下布局可读。

## 完成定义

- 请求范围内的行为已实现，没有顺手修改无关功能。
- `npm run check` 通过；需要时发布包校验通过。
- 权限、数据流或用户操作发生变化时，相关文档已同步。
- 最终说明包含改动结果、验证情况和仍存在的限制。

## Git 约定

- `master` 是生产主分支，`develop` 是日常集成分支。
- 普通开发从 `develop` 创建 `feature/*` 或 `fix/*` 分支，并通过 Pull Request 回到 `develop`。
- `release/*` 从 `develop` 创建，完成后合并到 `master` 并回合并 `develop`。
- `hotfix/*` 从 `master` 创建，完成后同时合并到 `master` 和 `develop`。
- 未经用户明确要求，AI 代理不得直接向 `master` 提交普通功能，也不得自行创建版本标签或推送远端。
- 提交应小而聚焦，使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`。
- 不重写用户提交，不使用破坏性 Git 命令，不提交 `dist/`、`release/`、密钥或本地环境文件。
- 完整规则见 `docs/GIT_WORKFLOW.md`。
