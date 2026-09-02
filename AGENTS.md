# AGENTS.md

本文件定义 AI 编码代理在 Curio 仓库中的工作约定，作用域覆盖整个仓库。若未来子目录存在更具体的 `AGENTS.md`，以距离目标文件最近的规则为准。

## 项目目标

Curio 是一个基于 Chrome Manifest V3 Side Panel API 的网页阅读与对话扩展。它提取当前标签页的可读文本，将网页内容作为不可信上下文提交给模型，并在侧边栏中维持按标签页隔离的多轮会话。

当前前端技术栈为 React、TypeScript、Vite 和 CRXJS。保持运行时依赖克制；引入新依赖前必须说明维护价值、包体影响和许可证。

## 开始工作前

1. 阅读 `README.md` 和与任务相关的 `docs/` 文档。
2. 阅读 `docs/GIT_WORKFLOW.md`，运行 `git status --short --branch`，确认当前分支与工作区状态。
3. 确认任务已经完成开发申请，且当前位于符合任务类型的主题分支；不得直接在 `master` 或 `develop` 上开发。
4. 保留用户已有修改，不覆盖、暂存或提交无关变更。
5. 阅读待修改文件及其直接调用方，确认 Manifest 权限和数据流影响。
6. 若任务涉及权限、隐私或模型请求，同时阅读 `SECURITY.md` 和 `docs/PRIVACY.md`。

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

以下规则是所有人工开发与 AI 开发的强制流程，完整定义、申请模板和命令见 `docs/GIT_WORKFLOW.md`。

### 分支与申请

- `master` 是生产分支，`develop` 是日常集成分支；二者都是受保护长期分支，禁止直接开发和直接提交。
- 开始修改前必须有可追溯的开发申请。GitHub Issue、工单或用户在当前会话中明确提出并批准的任务均可作为申请；申请至少包含目标、范围、验收标准、风险及建议分支名。
- AI 在创建分支前必须复述申请编号或会话任务、基线分支和拟用分支名。需求明确且用户已要求实施时，可将该指令视为批准；范围不明确或会扩大权限、数据流、依赖时必须先询问。
- 普通主题分支从最新 `develop` 创建，命名为 `<type>/<issue>-<slug>`；没有 Issue 时可用 `<type>/<slug>`。允许类型：`feature`、`fix`、`docs`、`refactor`、`test`、`chore`。
- `release/<version>` 从 `develop` 创建；`hotfix/<issue>-<slug>` 或 `hotfix/<version>` 从 `master` 创建。
- 一个分支只处理一个申请。发现无关问题时另建申请和分支，不顺手混入。

### 开发与提交

- 修改前再次运行 `git status --short --branch`；若存在来源不明的改动，先识别归属，不得覆盖或混入提交。
- 提交前必须检查 `git diff`、运行与改动匹配的验证，并使用明确文件路径暂存；禁止无检查地使用 `git add .`、`git add -A` 或提交整个脏工作区。
- 暂存后必须运行 `git diff --cached --check`，并检查 `git diff --cached` 与 `git status --short`，确认没有生成物、密钥、用户数据和无关文件。
- 每个提交保持单一目的并可独立审查。提交信息使用 Conventional Commits：`<type>(<scope>): <summary>`；`scope` 可省略，摘要使用英文祈使句、不加句号，建议不超过 72 个字符。
- 允许的提交类型为 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`、`perf`、`revert`。破坏性变更使用 `!` 并在正文中写 `BREAKING CHANGE:`。
- 不使用 `--no-verify` 绕过检查，不修改或重写用户提交，不使用破坏性 Git 命令。未经用户明确要求，不执行 rebase、force push、创建标签、推送远端或合并长期分支。

### 合并与完成

- `feature/*`、`fix/*`、`docs/*`、`refactor/*`、`test/*`、`chore/*` 通过 Pull Request 合并到 `develop`，推荐 Squash and merge。
- `release/*` 通过 Pull Request 合并到 `master`，发布后必须回合并 `develop`；`hotfix/*` 必须分别合并到 `master` 和 `develop`。
- PR 必须关联开发申请，说明范围、验证、风险、权限与隐私影响；CI 通过且评审意见解决后方可合并。
- AI 完成任务时必须报告当前分支、改动摘要、验证结果、是否已提交/推送/创建 PR，以及仍需用户处理的后续步骤。
- 不提交 `dist/`、`release/`、`node_modules/`、密钥、用户数据或本地环境文件。
