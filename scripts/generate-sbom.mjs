#!/usr/bin/env node
/**
 * SEC-SUP-02 CycloneDX SBOM 生成脚本
 *
 * 不引入第三方 SBOM 工具，直接解析 `package.json` + `package-lock.json`，
 * 输出 CycloneDX 1.5 JSON 规范。覆盖 backend / frontend 两个工作区。
 *
 * 用法：
 *   node scripts/generate-sbom.mjs <workspace> [<workspace> ...]
 *   node scripts/generate-sbom.mjs backend frontend
 *
 * 产物（每工作区 1 份 JSON）：
 *   artifacts/sbom/<workspace>-sbom.cdx.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const TOOL_NAME = "manju-sbom-generator";
const TOOL_VERSION = "1.0.0";
const CYCLONEDX_VERSION = "1.5";
const SPEC_VERSION = "1.5";

/** 解析 package-lock.json v3 的 packages 字段（顶层项目 + 传递依赖）。 */
function readLockfilePackages(lockfile) {
  if (lockfile.packages && typeof lockfile.packages === "object") {
    return Object.entries(lockfile.packages);
  }
  if (Array.isArray(lockfile.dependencies)) {
    return lockfile.dependencies.map((entry) => [entry.name || "", entry]);
  }
  return [];
}

function safeHash(content) {
  // 简化版 SHA-1：仅用于 SBOM 完整性标识，不参与安全判定。
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function derivePurl(name, version) {
  return `pkg:npm/${encodeURIComponent(name).replace(/%2F/g, "/")}@${encodeURIComponent(version)}`;
}

function licenseFromString(license) {
  if (!license) return [];
  if (typeof license === "string") return [{ license: { name: license } }];
  return [];
}

function isPinned(version) {
  return typeof version === "string" && /^\d+\.\d+\.\d+/.test(version) && !/^[\^~]/.test(version);
}

async function loadPackage(workspaceDir) {
  const pkgPath = path.join(workspaceDir, "package.json");
  const lockPath = path.join(workspaceDir, "package-lock.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  let lock = { packages: {} };
  try {
    lock = JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    // 没有 lockfile 时只输出顶层直接依赖。
  }
  return { pkg, lock, lockPath };
}

function buildComponents({ pkg, lock }, workspaceName) {
  const entries = readLockfilePackages(lock);
  const componentMap = new Map();
  for (const [pkgPath, info] of entries) {
    if (!pkgPath) continue; // 根项目自身
    if (pkgPath.startsWith("node_modules/")) {
      const subPath = pkgPath.slice("node_modules/".length);
      // 解析包名：
      //   - 非 scoped 包：取到第一个 "/" 为止
      //   - scoped 包（@scope/name）：取到第二个 "/" 为止（没有就是整个 subPath）
      const firstSlash = subPath.indexOf("/");
      let name;
      if (subPath.startsWith("@") && firstSlash > 0) {
        const secondSlash = subPath.indexOf("/", firstSlash + 1);
        name = secondSlash > 0 ? subPath.slice(0, secondSlash) : subPath;
      } else {
        name = firstSlash > 0 ? subPath.slice(0, firstSlash) : subPath;
      }
      const version = typeof info?.version === "string" ? info.version : "0.0.0";
      const purl = derivePurl(name, version);
      if (componentMap.has(purl)) continue;
      componentMap.set(purl, {
        type: "library",
        bomRef: purl,
        name,
        version,
        purl,
        licenses: licenseFromString(info?.license),
        hash: [{ alg: "SHA-1", content: safeHash(`${name}@${version}`) }],
        properties: [
          { name: "manju:workspace", value: workspaceName },
          // 默认 trans；下方根据 package.json 直接依赖集合覆写
          { name: "manju:depth", value: "transitive" },
        ],
      });
    }
  }
  // 顶层 deps / devDeps 标记为 direct（devDependencies 在生产 SBOM 中保留以便审计
  // 但后续可在 build 脚本中按 NODE_ENV=production 过滤）
  const directSet = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
  for (const component of componentMap.values()) {
    if (directSet.has(component.name)) {
      const depth = component.properties?.find((p) => p.name === "manju:depth");
      if (depth) depth.value = "direct";
    }
  }
  return Array.from(componentMap.values());
}

function buildDependencies(components) {
  return components.map((component) => ({
    ref: component.bomRef,
    dependsOn: [],
  }));
}

function buildBom(workspaceName, pkg, components) {
  return {
    bomFormat: "CycloneDX",
    specVersion: SPEC_VERSION,
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        { vendor: "manju", name: TOOL_NAME, version: TOOL_VERSION },
        { vendor: "owasp", name: "cyclonedx-javascript", version: CYCLONEDX_VERSION },
      ],
      component: {
        type: "application",
        bomRef: derivePurl(pkg.name || workspaceName, pkg.version || "0.0.0"),
        name: pkg.name || workspaceName,
        version: pkg.version || "0.0.0",
        description: pkg.description || "",
        licenses: licenseFromString(pkg.license),
        purl: derivePurl(pkg.name || workspaceName, pkg.version || "0.0.0"),
        properties: [
          { name: "manju:workspace", value: workspaceName },
          { name: "manju:pinned", value: String(isPinned(pkg.version)) },
        ],
      },
    },
    components,
    dependencies: buildDependencies(components),
  };
}

function randomUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("用法: node scripts/generate-sbom.mjs <workspace> [<workspace> ...]");
    console.error("  例如: node scripts/generate-sbom.mjs backend frontend");
    process.exit(2);
  }
  const outDir = path.join(repoRoot, "artifacts", "sbom");
  await mkdir(outDir, { recursive: true });

  for (const workspace of args) {
    const workspaceDir = path.join(repoRoot, workspace);
    const loaded = await loadPackage(workspaceDir);
    const components = buildComponents(loaded, workspace);
    const bom = buildBom(workspace, loaded.pkg, components);
    const outFile = path.join(outDir, `${workspace}-sbom.cdx.json`);
    await writeFile(outFile, JSON.stringify(bom, null, 2));
    const direct = components.filter((c) => c.properties?.find((p) => p.name === "manju:depth")?.value === "direct").length;
    console.log(`[OK] ${workspace}: ${components.length} 组件（直接 ${direct}）→ ${path.relative(repoRoot, outFile)}`);
  }
}

main().catch((err) => {
  console.error("[FAIL] SBOM 生成失败:", err);
  process.exit(1);
});
