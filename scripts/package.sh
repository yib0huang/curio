#!/bin/sh
set -eu

# 所有路径都从仓库根目录解析，确保脚本可从任意工作目录执行。
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -p "require('$PROJECT_ROOT/manifest.json').version")
OUTPUT_DIR="$PROJECT_ROOT/dist"
OUTPUT_FILE="$OUTPUT_DIR/curio-$VERSION.zip"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"

# 发布包仅包含扩展运行文件，不携带开发文档、历史 Logo 或工程脚本。
cd "$PROJECT_ROOT"
zip -q -r "$OUTPUT_FILE" \
  manifest.json \
  src \
  assets/icons-v3

echo "已生成 $OUTPUT_FILE"
