#!/bin/sh
set -eu

# 所有路径都从仓库根目录解析，确保脚本可从任意工作目录执行。
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -p "require('$PROJECT_ROOT/manifest.json').version")
OUTPUT_DIR="$PROJECT_ROOT/release"
OUTPUT_FILE="$OUTPUT_DIR/curio-$VERSION.zip"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"

# Vite 已将浏览器所需文件输出到 dist，ZIP 根目录必须直接包含构建后的 manifest.json。
cd "$PROJECT_ROOT/dist"
zip -q -r "$OUTPUT_FILE" .

echo "已生成 $OUTPUT_FILE"
