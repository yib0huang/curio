# Curio 工程任务入口。
#
# Makefile 只编排 package.json 与 scripts/ 中已有的任务，避免维护两套构建逻辑。
# Node.js、npm 与 unzip 路径可在命令行覆盖，例如：make build NPM=/opt/node/bin/npm。

SHELL := /bin/sh
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
.SUFFIXES:
MAKEFLAGS += --no-builtin-rules

NODE ?= node
NPM ?= npm
UNZIP ?= unzip

# 清理目标必须固定在仓库生成目录，不能被命令行参数扩大到仓库外。
override DIST_DIR := dist
override RELEASE_DIR := release
override PACKAGE_PREFIX := curio

.PHONY: help doctor install ci-install dev typecheck validate check build rebuild \
	package package-verify package-list ci clean clean-package clean-deps clean-all version paths

help: ## 显示可用目标及用途（默认目标）
	@awk 'BEGIN { FS = ":.*## "; printf "Curio 工程命令\n\n用法:\n  make <目标> [变量=值]\n\n目标:\n" } /^[a-zA-Z0-9_-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf '\n可覆盖工具变量:\n  NODE=%s\n  NPM=%s\n  UNZIP=%s\n' "$(NODE)" "$(NPM)" "$(UNZIP)"

doctor: ## 检查构建、打包所需工具并输出版本
	@set -eu; \
	for tool in "$(NODE)" "$(NPM)" zip "$(UNZIP)"; do \
		command -v "$$tool" >/dev/null 2>&1 || { printf '错误：缺少必需工具 %s\n' "$$tool" >&2; exit 1; }; \
	done; \
	printf 'Node.js: %s\n' "$$($(NODE) --version)"; \
	printf 'npm:     %s\n' "$$($(NPM) --version)"; \
	printf 'zip:     %s\n' "$$(command -v zip)"; \
	printf 'unzip:   %s\n' "$$(command -v "$(UNZIP)")"

install: ## 安装开发依赖，并按需更新 package-lock.json
	$(NPM) install

ci-install: ## 严格按照 package-lock.json 执行可复现依赖安装
	$(NPM) ci

dev: ## 启动 Vite/CRXJS 开发构建与文件监听
	$(NPM) run dev

typecheck: ## 执行严格 TypeScript 类型检查
	$(NPM) run typecheck

validate: ## 校验 Manifest、资源引用和版本一致性
	$(NODE) scripts/validate.mjs

check: ## 执行提交前完整静态检查
	$(NPM) run check

build: ## 完成检查并生成可加载的 dist 扩展目录
	$(NPM) run build

rebuild: ## 清理构建目录后重新构建
	@$(MAKE) --no-print-directory clean
	@$(MAKE) --no-print-directory build

package: ## 构建发布 ZIP，并列出归档内容供审查
	$(NPM) run package
	@$(MAKE) --no-print-directory package-verify
	@$(MAKE) --no-print-directory package-list

package-verify: ## 校验当前版本发布 ZIP 的完整性和根级 Manifest
	@set -eu; \
	version="$$($(NODE) -p "require('./package.json').version")"; \
	archive="$(RELEASE_DIR)/$(PACKAGE_PREFIX)-$$version.zip"; \
	test -f "$$archive" || { printf '错误：发布包不存在：%s；请先运行 make package。\n' "$$archive" >&2; exit 1; }; \
	$(UNZIP) -tq "$$archive"; \
	$(UNZIP) -Z1 "$$archive" | grep -qx 'manifest.json' || { printf '错误：发布包根目录缺少 manifest.json。\n' >&2; exit 1; }

package-list: ## 列出当前版本发布 ZIP 的文件清单
	@set -eu; \
	version="$$($(NODE) -p "require('./package.json').version")"; \
	archive="$(RELEASE_DIR)/$(PACKAGE_PREFIX)-$$version.zip"; \
	test -f "$$archive" || { printf '错误：发布包不存在：%s；请先运行 make package。\n' "$$archive" >&2; exit 1; }; \
	$(UNZIP) -l "$$archive"

ci: ## 执行 CI 使用的可复现安装、检查、构建与打包
	@$(MAKE) --no-print-directory ci-install
	@$(MAKE) --no-print-directory package

clean: ## 删除可重新生成的 dist 构建目录
	rm -rf -- "$(DIST_DIR)"

clean-package: ## 删除可重新生成的 release 发布目录
	rm -rf -- "$(RELEASE_DIR)"

clean-deps: ## 删除 node_modules；不会修改依赖锁文件
	rm -rf -- node_modules

clean-all: clean clean-package clean-deps ## 删除全部本地生成物和已安装依赖

version: ## 输出 package.json 中的当前版本
	@$(NODE) -p "require('./package.json').version"

paths: ## 输出构建目录和当前版本发布包路径
	@version="$$($(NODE) -p "require('./package.json').version")"; \
	printf '构建目录: %s\n发布目录: %s\n发布包:   %s\n' \
		"$(DIST_DIR)" "$(RELEASE_DIR)" "$(RELEASE_DIR)/$(PACKAGE_PREFIX)-$$version.zip"
