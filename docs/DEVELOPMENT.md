# 开发说明

开始开发前请先阅读 [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) 和 [`CODE_STYLE.md`](CODE_STYLE.md)。日常功能从 `develop` 创建临时分支，生产版本只通过 `release/*` 或 `hotfix/*` 进入 `master`。

## 快速开始

```bash
make install
make check
make build
```

开发源码使用 React + TypeScript。打开 `chrome://extensions/`，启用开发者模式并加载构建生成的 `dist/` 目录。

常用命令：

- `make help`：显示完整目标说明和可覆盖变量。
- `make doctor`：检查本地构建和打包工具。
- `make dev`：启动监听构建；源码变化后在扩展页重新加载。
- `make typecheck`：执行严格 TypeScript 类型检查。
- `make validate`：单独执行 Manifest、资源和版本检查。
- `make check`：执行完整静态检查。
- `make build`：完成检查并生成 `dist/` 可加载扩展。
- `make rebuild`：清理 `dist/` 后重新构建。
- `make package`：生成 `release/curio-<version>.zip`，校验完整性和根级 Manifest，并列出文件清单。
- `make ci`：通过 `npm ci` 完成可复现安装，并运行检查、构建和打包。
- `make clean`、`make clean-package`、`make clean-deps`：分别清理构建目录、发布目录和依赖目录。

Makefile 是现有 npm 脚本的编排层；不使用 Make 时仍可直接运行 `npm run dev`、`npm run check`、`npm run build` 和 `npm run package`。Node.js、npm 与 unzip 路径可通过命令行变量覆盖，例如 `make build NPM=/opt/node/bin/npm`。输出目录保持为项目约定的 `dist/` 和 `release/`，避免清理命令误删意外路径。

## 代码与注释要点

- 项目自有注释使用简体中文，标准 API、类型和标识符保持英文。
- TypeScript/TSX 使用 TSDoc/JSDoc 风格，HTML 使用 `<!-- -->`，CSS 使用 `/* */`，Shell 使用 `#`。
- JSON 不支持注释；配置原因写入对应文档。
- 注释重点解释设计原因、安全边界、兼容处理和非显然约束，不重复描述代码表面行为。
- 公共入口、复杂函数和具有副作用的工程操作必须有必要说明。
- 第三方代码必须保留许可证要求的版权与来源信息。

完整示例和评审清单见 `CODE_STYLE.md`。

## 修改与调试

修改代码后：

- 修改 `src/content/page-reader.ts` 或 `manifest.json`：重新构建、重新加载扩展，并刷新被测试网页。
- 修改 `src/background/service-worker.ts`：重新构建并重新加载扩展以重启 Service Worker。
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
7. 检查 `release/curio-<version>.zip` 中没有密钥、日志、草稿或无关文件。
8. 按 `GIT_WORKFLOW.md` 合并到 `master`、创建版本标签并回合并到 `develop`。

## 增加依赖

引入依赖前应说明它解决的问题、包体影响、许可证和替代方案。运行时代码不得从 CDN 加载；需要使用的代码必须固定版本并随扩展打包，以符合 Manifest V3 的远程代码限制。
