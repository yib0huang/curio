/**
 * @file Curio Chrome 扩展的 Vite 与 CRXJS 构建配置。
 */

import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

/**
 * Vite 负责 React/TypeScript 构建，CRXJS 负责将源码入口转换为可加载的 Manifest V3 扩展。
 */
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
