# 开发说明

开始开发前请先阅读 [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) 和 [`CODE_STYLE.md`](CODE_STYLE.md)。日常功能从 `develop` 创建临时分支，生产版本只通过 `release/*` 或 `hotfix/*` 进入 `master`。

## 快速开始

```bash
npm run check
```

无需安装 npm 依赖。打开 `chrome://extensions/`，启用开发者模式并加载仓库根目录，即可调试扩展。

## 代码与注释要点

- 项目自有注释使用简体中文，标准 API、类型和标识符保持英文。
- JavaScript 使用 JSDoc，HTML 使用 `<!-- -->`，CSS 使用 `/* */`，Shell 使用 `#`。
- JSON 不支持注释；配置原因写入对应文档。
- 注释重点解释设计原因、安全边界、兼容处理和非显然约束，不重复描述代码表面行为。
- 公共入口、复杂函数和具有副作用的工程操作必须有必要说明。
- 第三方代码必须保留许可证要求的版权与来源信息。

完整示例和评审清单见 `CODE_STYLE.md`。

## 修改与调试

修改代码后：

- 修改 `src/content/page-reader.js` 或 `manifest.json`：重新加载扩展，并刷新被测试网页。
- 修改 `src/background/service-worker.js`：重新加载扩展以重启 Service Worker。
- 修改 Side Panel 文件：重新加载扩展，必要时关闭并重新打开侧边栏。

## 调试入口

- Background：扩展详情页中的 “Service Worker”。
- Content Script：目标网页的 DevTools Console。
- Side Panel：在侧边栏中右键选择“检查”。

## 发布检查

1. 从 `develop` 创建 `release/<version>` 分支。
2. 同步更新 `manifest.json` 与 `package.json` 版本。
3. 将用户可见变化写入 `CHANGELOG.md`。
4. 运行 `npm run check`。
5. 完成 `AGENTS.md` 中的手动验证清单。
6. 运行 `npm run package`。
7. 检查 `dist/curio-<version>.zip` 中没有密钥、日志、草稿或无关文件。
8. 按 `GIT_WORKFLOW.md` 合并到 `master`、创建版本标签并回合并到 `develop`。

## 增加依赖

引入依赖前应说明它解决的问题、包体影响、许可证和替代方案。运行时代码不得从 CDN 加载；需要使用的代码必须固定版本并随扩展打包，以符合 Manifest V3 的远程代码限制。
