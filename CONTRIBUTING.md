# 贡献指南

感谢参与 Curio。开始修改前请先阅读根目录的 `AGENTS.md`；无论由人还是 AI 代理完成代码，该文件中的工程、安全和验证约定都适用。

## 开发环境

- Google Chrome，支持 Manifest V3 Side Panel API
- Node.js 20 或更高版本
- npm 10 或更高版本
- macOS 或提供 POSIX Shell 与 `zip` 的兼容环境

本项目目前没有第三方 npm 依赖，不需要执行 `npm install`。

## 开发流程

1. 从 `main` 创建主题分支。
2. 保持一次变更只解决一个明确问题。
3. 运行 `npm run check`。
4. 在 `chrome://extensions/` 重新加载扩展并手动验证相关流程。
5. 涉及发布内容时运行 `npm run package` 并检查 ZIP 文件列表。
6. 更新 README、CHANGELOG 或 `docs/` 中受影响的内容。

## 提交规范

推荐使用 Conventional Commits：

```text
feat: add page refresh action
fix: isolate conversations by tab
docs: document extension permissions
chore: update release packaging
```

提交中不要包含：

- `dist/` 生成物
- API Key、令牌、Cookie 或 `.env` 文件
- 与当前任务无关的格式化或重构
- 未说明用途的 Chrome 权限

## Pull Request 检查项

- 说明用户可见变化和实现范围。
- 写明执行过的自动检查和手动验证。
- 标注新增权限、数据流或隐私影响。
- UI 变化附上截图；行为变化提供复现步骤。
- 已知限制和后续工作需要明确列出。

