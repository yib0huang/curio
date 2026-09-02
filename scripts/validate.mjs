import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.manifest_version !== 3) {
  throw new Error("manifest.json 必须使用 Manifest V3");
}

const referencedFiles = new Set([
  manifest.background?.service_worker,
  manifest.side_panel?.default_path,
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

const scripts = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
  "sidepanel.js"
].filter(Boolean);

for (const script of scripts) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, script)], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

console.log(`Curio 工程校验通过：${referencedFiles.size} 个资源文件，${scripts.length} 个脚本。`);

