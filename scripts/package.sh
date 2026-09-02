#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -p "require('$PROJECT_ROOT/manifest.json').version")
OUTPUT_DIR="$PROJECT_ROOT/dist"
OUTPUT_FILE="$OUTPUT_DIR/curio-$VERSION.zip"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"

cd "$PROJECT_ROOT"
zip -q -r "$OUTPUT_FILE" \
  manifest.json \
  background.js \
  content.js \
  sidepanel.html \
  sidepanel.css \
  sidepanel.js \
  assets/icons-v3

echo "已生成 $OUTPUT_FILE"

