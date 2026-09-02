/**
 * @file 工程静态校验脚本。
 * 校验 Manifest V3、资源引用和工程版本一致性，不修改任何项目文件。
 */

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

// Manifest 是 Chrome 的运行入口，版本错误应在打包前立即失败。
if (manifest.manifest_version !== 3) {
  throw new Error("manifest.json 必须使用 Manifest V3");
}

if (manifest.version !== packageJson.version) {
  throw new Error("manifest.json 与 package.json 的版本号必须一致");
}

const sidePanelPath = manifest.side_panel?.default_path;
const sidePanelHtml = sidePanelPath
  ? await readFile(path.join(root, sidePanelPath), "utf8")
  : "";

// HTML 内的本地资源相对于页面目录解析；远程地址和页内锚点不属于扩展文件。
const sidePanelResources = [...sidePanelHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((resource) => !/^(?:[a-z]+:|#)/i.test(resource))
  .map((resource) => path.posix.normalize(path.posix.join(path.posix.dirname(sidePanelPath), resource)));

const referencedFiles = new Set([
  manifest.background?.service_worker,
  sidePanelPath,
  ...sidePanelResources,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  ...(manifest.content_scripts || []).flatMap((entry) => [
    ...(entry.js || []),
    ...(entry.css || [])
  ])
].filter(Boolean));

for (const file of referencedFiles) {
  await access(path.join(root, file), constants.R_OK);
}

const sourceEntries = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
  ...sidePanelResources.filter((resource) => /\.[cm]?[jt]sx?$/.test(resource))
].filter(Boolean);

// TypeScript 语法和类型由 npm run typecheck 负责，这里只统计并验证入口文件存在。
console.log(
  `Curio 工程校验通过：${referencedFiles.size} 个资源文件，${sourceEntries.length} 个源码入口。`
);
