# Git 分支管理

Curio 使用以 `master` 和 `develop` 为核心的轻量 Git Flow。该模型适合有明确版本发布节奏的浏览器扩展：生产代码稳定，日常功能可以持续集成。

## 长期分支

| 分支 | 用途 | 接受合并来源 | 是否允许直接提交 |
| --- | --- | --- | --- |
| `master` | 生产分支；每个提交都应可发布 | `release/*`、`hotfix/*` | 否 |
| `develop` | 下一版本的集成分支 | `feature/*`、`fix/*`、完成后的 `release/*` 与 `hotfix/*` 回合并 | 否 |

`master` 是仓库默认分支。日常开发从 `develop` 开始，不从 `master` 直接开发普通功能。

## 临时分支

### 功能分支

- 命名：`feature/<issue>-<short-name>`；没有 Issue 时可用 `feature/<short-name>`。
- 起点：`develop`。
- 终点：通过 Pull Request 合并回 `develop`。
- 示例：`feature/42-streaming-response`。

### 修复分支

- 命名：`fix/<issue>-<short-name>`。
- 起点：`develop`。
- 终点：通过 Pull Request 合并回 `develop`。
- 用于尚未发布版本中的普通缺陷。

### 发布分支

- 命名：`release/<semver>`，例如 `release/0.2.0`。
- 起点：`develop`。
- 只允许版本号、CHANGELOG、文档及发布阻断问题修复，不再加入新功能。
- 验证通过后合并到 `master`，在合并提交上创建 `v<semver>` 标签。
- 必须再合并回 `develop`，避免发布修复丢失。

### 热修复分支

- 命名：`hotfix/<semver>` 或 `hotfix/<issue>-<short-name>`。
- 起点：`master`。
- 用于已经发布版本的紧急生产问题。
- 修复后分别合并到 `master` 和 `develop`；如存在未完成的 `release/*`，也应同步进入该分支。
- 发布型热修复需要创建新的语义化版本标签。

## 合并策略

- `feature/*`、`fix/*` 合并到 `develop`：推荐 **Squash and merge**，保持集成历史紧凑。
- `release/*`、`hotfix/*` 合并到长期分支：推荐 **Merge commit**，保留版本边界和双向合并关系。
- Pull Request 合并前必须更新目标分支并解决冲突。
- 禁止向 `master` 和 `develop` 强制推送或重写历史。
- 分支合并后删除对应的远端临时分支。

## 标准工作流

### 开发功能

```bash
git switch develop
git pull --ff-only
git switch -c feature/42-streaming-response

# 开发并提交
npm run check
git push -u origin feature/42-streaming-response
```

Pull Request 的目标分支选择 `develop`。

### 发布版本

```bash
git switch develop
git pull --ff-only
git switch -c release/0.2.0

# 更新 manifest.json、package.json 和 CHANGELOG.md
npm run check
npm run package
git push -u origin release/0.2.0
```

发布 Pull Request 合并到 `master` 后：

```bash
git switch master
git pull --ff-only
git tag -a v0.2.0 -m "Release 0.2.0"
git push origin v0.2.0
```

随后将 `release/0.2.0` 合并回 `develop`。

## Pull Request 要求

- 一个 PR 只包含一个明确主题。
- 标题使用 Conventional Commits 风格。
- 描述用户影响、实现范围、验证结果和隐私/权限变化。
- `npm run check` 必须通过。
- Manifest、发布结构或资源变化还需运行 `npm run package`。
- 至少一名维护者批准后方可合并；作者不能批准自己的 PR。
- 所有评审意见已解决，且分支与目标分支不存在冲突。

## 远端分支保护

建立 GitHub 或 GitLab 远端后，为 `master` 和 `develop` 启用：

- 禁止直接推送，必须通过 Pull Request/Merge Request。
- 至少 1 个批准；团队扩大后建议 2 个。
- 新提交出现后撤销旧批准。
- 必需状态检查：`validate`。
- 合并前要求分支为最新状态。
- 禁止 force push 和删除长期分支。
- 要求所有讨论解决后才能合并。

额外建议：

- `master` 仅允许 `release/*`、`hotfix/*` 进入。
- 仅维护者可以创建 `v*` 标签和发布版本。
- 配置 `master` 为默认分支，但所有新开发 PR 的目标应手动选择 `develop`。

## 提交与版本

- 提交使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`。
- 版本遵循 Semantic Versioning。
- `manifest.json` 与 `package.json` 的版本必须一致。
- 生产发布使用带注释标签：`v0.2.0`。
- 不为普通 `develop` 提交打版本标签。

