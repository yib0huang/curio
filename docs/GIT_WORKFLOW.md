# Git 开发与交付规范

本规范适用于 Curio 的人工开发和 AI 代理开发，覆盖开发申请、分支创建、编码、验证、提交、Pull Request、发布与热修复。`AGENTS.md` 将本文件列为 AI 必读规则；任何偏离都必须由维护者明确批准并留下记录。

## 1. 基本原则

- 先申请、后建分支、再修改代码。
- 一个开发申请对应一个主题分支，一个分支只解决一个明确问题。
- `master` 和 `develop` 只接受 Pull Request，不直接开发、提交或强制推送。
- 提交应可审查、可验证、可回滚，不混入无关修改。
- 不提交生成物、密钥、用户数据和本地环境文件。
- AI 不得自行推送、合并、创建标签或改写历史，除非用户明确要求。

## 2. 长期分支

| 分支 | 定位 | 接受来源 | 直接提交 |
| --- | --- | --- | --- |
| `master` | 生产分支，每个提交都应具备发布条件 | `release/*`、`hotfix/*` | 禁止 |
| `develop` | 下一版本的日常集成分支 | 普通主题分支、完成后的 `release/*` 与 `hotfix/*` | 禁止 |

远端建立后，应为两个长期分支启用分支保护：禁止删除和 force push；要求 PR、至少一名维护者批准、`validate` 状态检查通过、讨论全部解决、合并前分支为最新状态。

仓库初始化、历史重建或分支模型首次落地属于治理例外，只有维护者明确要求时才可直接创建长期分支或在 `master` 建立根提交，并在结果中说明。

## 3. 开发申请

### 3.1 何时必须申请

任何会修改仓库内容的工作都必须先有开发申请，包括功能、缺陷、文档、重构、测试、依赖、CI、构建、发布和热修复。纯读取、分析和答疑不需要创建分支。

以下任一种记录可作为申请：

- 使用 `.github/ISSUE_TEMPLATE/development-request.md` 创建的 Issue；
- 团队工单或需求系统中的可访问记录；
- 用户在 AI 会话中明确提出并要求实施的任务。

### 3.2 必填信息

申请至少包含：

1. 背景与目标；
2. 本次范围与不在范围内的内容；
3. 可验证的验收标准；
4. 权限、隐私、依赖、兼容性和发布风险；
5. 分支类型、基线分支、建议分支名与负责人；
6. 自动检查和手动验证计划。

维护者批准范围与风险后才能创建分支。用户已经明确要求 AI 实施且范围完整时，该指令可视为批准；若存在会改变产品方向、扩大 Chrome 权限或数据流、引入依赖等未决选择，AI 必须先询问，不能自行扩大申请。

### 3.3 AI 开工记录

AI 创建分支前必须向用户说明：

- 申请编号或当前会话任务；
- 计划使用的基线分支；
- 计划创建的分支名；
- 发现的脏工作区或风险。

## 4. 分支类型与命名

普通主题分支格式为 `<type>/<issue>-<slug>`。`issue` 为 Issue 或工单编号；没有编号时使用 `<type>/<slug>`。`slug` 使用小写英文、数字和连字符，简短描述任务，不使用空格、下划线、中文或个人姓名。

| 类型 | 用途 | 基线 | PR 目标 | 示例 |
| --- | --- | --- | --- | --- |
| `feature` | 新增用户能力 | `develop` | `develop` | `feature/42-streaming-response` |
| `fix` | 修复未发布版本缺陷 | `develop` | `develop` | `fix/57-tab-session-leak` |
| `docs` | 仅文档变化 | `develop` | `develop` | `docs/61-git-workflow` |
| `refactor` | 不改变外部行为的重构 | `develop` | `develop` | `refactor/68-model-client` |
| `test` | 测试补充或调整 | `develop` | `develop` | `test/72-settings-store` |
| `chore` | 工具、依赖和维护工作 | `develop` | `develop` | `chore/80-update-vite` |
| `release` | 版本稳定与发布准备 | `develop` | `master` | `release/0.2.0` |
| `hotfix` | 已发布生产版本的紧急修复 | `master` | `master` 与 `develop` | `hotfix/91-api-regression` |

CI 变更归入 `chore/*`，提交类型使用 `ci`；构建系统变更归入 `chore/*`，提交类型使用 `build`。不要为同一申请同时创建多个同义分支。

## 5. 标准开发流程

### 5.1 开始工作

```bash
git status --short --branch
git switch develop
git pull --ff-only
git switch -c feature/42-streaming-response
```

如果仓库尚未配置远端，不执行 `git pull`，并在交付说明中注明。若工作区已有修改，先确认修改归属；不得擅自丢弃、暂存、提交或带入新分支。

### 5.2 实现与自检

- 只修改申请范围内的文件。
- 阅读目标文件及直接调用方；权限、隐私或模型请求变更还要阅读 `SECURITY.md` 和 `docs/PRIVACY.md`。
- 经常使用 `git diff` 检查偏离和意外修改。
- 每次代码修改至少运行 `npm run check`。
- Manifest、资源或发布结构变化还要运行 `npm run package` 和 `unzip -l release/curio-<version>.zip`。
- 交互变化要在 Chrome 中完成 `AGENTS.md` 定义的手动验证，并在 PR 中记录结果。

### 5.3 暂存与提交

```bash
git diff
npm run check
git add src/example.ts docs/example.md
git diff --cached --check
git diff --cached
git status --short
git commit -m "feat(reader): add page refresh action"
```

必须使用明确文件路径暂存本次任务的文件。禁止在未审查工作区时使用 `git add .`、`git add -A`、`git commit -a`；禁止用 `--no-verify` 绕过检查。

提交完成后运行：

```bash
git status --short --branch
git log -1 --oneline
```

工作区应保持干净；若保留未提交内容，必须说明归属和原因。

## 6. Commit 规范

提交信息使用 Conventional Commits：

```text
<type>(<scope>): <summary>

<body>

<footer>
```

- `type` 必填：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`、`perf`、`revert`。
- `scope` 可选，使用稳定模块名，例如 `reader`、`sidepanel`、`settings`、`manifest`、`release`。
- `summary` 使用英文祈使句、小写开头、不加句号，建议整行不超过 72 个字符。
- 正文解释动机、约束和非显然取舍，不逐行复述代码。
- 关联申请可在页脚写 `Refs: #42`；关闭缺陷可写 `Closes: #57`。
- 破坏性变更在类型后加 `!`，并在页脚写 `BREAKING CHANGE: <影响和迁移方式>`。

示例：

```text
feat(reader): add manual page refresh
fix(session): isolate conversations by tab
docs(workflow): define branch request process
ci: validate pull requests to protected branches
```

一个提交只表达一个目的。以下情况应拆分提交：功能实现与无关重构、生产代码与批量格式化、依赖升级与业务行为变化、可独立回滚的文档或迁移。测试与其直接验证的实现可以放在同一提交中。

## 7. Pull Request 与合并

### 7.1 PR 必填内容

- 关联的开发申请；
- 用户可见变化、实现范围和明确排除项；
- 验收标准完成情况；
- 自动检查和手动验证结果；
- Chrome 权限、数据流、隐私、依赖和兼容性影响；
- 已知风险、回滚方式、截图或录屏（如适用）。

### 7.2 合并策略

- 普通主题分支合并到 `develop`：推荐 **Squash and merge**，Squash 标题必须符合 Commit 规范。
- `release/*`、`hotfix/*` 合并到长期分支：推荐 **Merge commit**，保留版本边界和回合并关系。
- 禁止未通过 CI、未解决评审意见或目标分支错误的 PR 合并。
- 合并后删除已完成的远端主题分支；本地分支确认不再需要后再删除。

AI 可以准备提交或 PR 文案，但只有用户明确要求时才能推送或创建、批准、合并 PR。

## 8. 发布流程

```bash
git switch develop
git pull --ff-only
git switch -c release/0.2.0
```

发布分支只允许版本号、CHANGELOG、文档和发布阻断修复，不加入新功能。完成 `npm run check`、`npm run package` 和发布包文件检查后，通过 PR 合并到 `master`。维护者在合并提交上创建带注释标签 `v<version>`，随后把发布结果回合并到 `develop`。

版本号遵循 Semantic Versioning，`manifest.json` 与 `package.json` 必须一致。AI 不得自行创建标签或发布版本。

## 9. 热修复流程

```bash
git switch master
git pull --ff-only
git switch -c hotfix/91-api-regression
```

热修复只处理已发布版本的紧急生产问题。修复验证后分别通过 PR 合并到 `master` 和 `develop`；若存在未完成的 `release/*`，还要同步到该发布分支。需要发布时更新补丁版本并由维护者创建标签。

## 10. 禁止事项

- 直接向 `master` 或 `develop` 开发、提交或推送；
- 未申请或未批准就创建开发分支；
- 一个分支混合多个无关需求；
- 提交 `dist/`、`release/`、`node_modules/`、`.env`、API Key、令牌、Cookie、用户网页内容或本地配置；
- 擅自执行 `git reset --hard`、`git clean -fd`、强制切换覆盖、rebase、commit amend、force push 或历史重写；
- 使用 `--no-verify` 绕过检查；
- 未经维护者批准扩大 Chrome 权限、模型数据流或运行时依赖。

## 11. AI 交付清单

AI 每次完成开发任务必须向用户报告：

1. 当前主题分支和对应申请；
2. 已实现的范围及未实现内容；
3. 自动检查、手动验证及结果；
4. Commit 哈希与信息（如果已提交）；
5. 是否已推送或创建 PR；
6. 风险、限制和需要用户继续执行的步骤。
