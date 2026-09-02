# 贡献指南

感谢参与 Curio。开始修改前请先阅读根目录的 `AGENTS.md`、[`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) 和 [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md)；无论由人还是 AI 代理完成代码，其中的分支、提交、工程、安全、中文注释和验证约定都适用。

## 开发环境

- Google Chrome，支持 Manifest V3 Side Panel API
- Node.js 20.19 或更高版本，推荐使用当前项目 CI 的 Node.js 22
- npm 10 或更高版本
- macOS 或提供 POSIX Shell 与 `zip` 的兼容环境

首次开发先执行 `npm install`。CI 和可复现环境使用 `npm ci` 按 `package-lock.json` 安装锁定版本。

## 开发流程

1. 使用开发申请模板创建 Issue 或工单，明确目标、范围、验收标准、风险和建议分支名。
2. 获得批准后，切换到 `develop` 并使用 `git pull --ff-only` 更新本地分支。
3. 从 `develop` 创建与申请对应的主题分支；一个分支只处理一个申请。
4. 修改前后检查 `git status --short --branch` 和 `git diff`，不得混入他人的改动。
5. 运行 `npm run check`，并按改动类型完成 Chrome 手动验证或发布包校验。
6. 更新 README、CHANGELOG 或 `docs/` 中受影响的内容。
7. 使用明确文件路径暂存，检查暂存差异后创建小而聚焦的 Conventional Commit。
8. 推送主题分支并通过 Pull Request 合并到规定的目标分支，不直接推送长期分支。

完整的分支类型、发布和热修复流程见 [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)。

## 提交规范

必须使用 Conventional Commits，格式为 `<type>(<scope>): <summary>`，`scope` 可省略：

```text
feat: add page refresh action
fix: isolate conversations by tab
docs: document extension permissions
chore: update release packaging
```

提交前至少执行：

```bash
git diff
npm run check
git add <本次任务相关文件>
git diff --cached --check
git diff --cached
git status --short
git commit -m "<type>(<scope>): <summary>"
```

禁止未经检查直接执行 `git add .` 或 `git add -A`。一次提交只表达一个目的；功能、重构、测试和文档在需要独立回滚时应拆分提交。

提交中不要包含：

- `dist/`、`release/` 生成物
- API Key、令牌、Cookie 或 `.env` 文件
- 与当前任务无关的格式化或重构
- 未说明用途的 Chrome 权限

## Pull Request 检查项

- 关联已批准的开发申请，并确认源分支与目标分支符合规范。
- 说明用户可见变化和实现范围。
- 写明执行过的自动检查和手动验证。
- 标注新增权限、数据流或隐私影响。
- UI 变化附上截图；行为变化提供复现步骤。
- 已知限制和后续工作需要明确列出。
