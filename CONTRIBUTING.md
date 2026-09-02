# 贡献指南

感谢参与 Curio。开始修改前请先阅读根目录的 `AGENTS.md` 和 [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md)；无论由人还是 AI 代理完成代码，其中的工程、安全、中文注释和验证约定都适用。

## 开发环境

- Google Chrome，支持 Manifest V3 Side Panel API
- Node.js 20.19 或更高版本，推荐使用当前项目 CI 的 Node.js 22
- npm 10 或更高版本
- macOS 或提供 POSIX Shell 与 `zip` 的兼容环境

首次开发先执行 `npm install`。CI 和可复现环境使用 `npm ci` 按 `package-lock.json` 安装锁定版本。

## 开发流程

1. 切换到 `develop` 并使用 `git pull --ff-only` 更新本地分支。
2. 从 `develop` 创建 `feature/*` 或 `fix/*` 主题分支。
3. 保持一次变更只解决一个明确问题。
4. 运行 `npm run check`。
5. 在 `chrome://extensions/` 重新加载扩展并手动验证相关流程。
6. 涉及发布内容时运行 `npm run package` 并检查 ZIP 文件列表。
7. 更新 README、CHANGELOG 或 `docs/` 中受影响的内容。
8. 通过 Pull Request 合并回 `develop`，不要直接推送长期分支。

完整的分支类型、发布和热修复流程见 [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)。

## 提交规范

推荐使用 Conventional Commits：

```text
feat: add page refresh action
fix: isolate conversations by tab
docs: document extension permissions
chore: update release packaging
```

提交中不要包含：

- `dist/`、`release/` 生成物
- API Key、令牌、Cookie 或 `.env` 文件
- 与当前任务无关的格式化或重构
- 未说明用途的 Chrome 权限

## Pull Request 检查项

- 说明用户可见变化和实现范围。
- 写明执行过的自动检查和手动验证。
- 标注新增权限、数据流或隐私影响。
- UI 变化附上截图；行为变化提供复现步骤。
- 已知限制和后续工作需要明确列出。
