// scripts/check-missing-source-files.mjs
// 扫描 dist/src/**/*.js（排除 .d.ts/.js.map），对照 src/ 下同名 .ts 源文件，
// 列出"dist 有但 src 没有"的源文件路径，作为恢复清单。
// 用法：node scripts/check-missing-source-files.mjs [root=backend]
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootArg = process.argv[2] || "backend";
// __dirname = <repo>/<rootArg>/scripts  -> repo root = dirname(__dirname)
// 兼容：从 <rootArg>/ 下运行时（cwd=<rootArg>），用 process.cwd()
const cwd = process.cwd();
const looksLikeRoot = await stat(join(cwd, "dist", "src")).then(
  () => true,
  () => false,
);
const root = looksLikeRoot ? cwd : join(__dirname, "..", rootArg);
const distRoot = join(root, "dist", "src");
const srcRoot = join(root, "src");

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else {
      out.push(p);
    }
  }
  return out;
}

function expectedTsForJs(jsAbsPath) {
  // dist/src/services/horizontal/x.js -> src/services/horizontal/x.ts
  const rel = relative(distRoot, jsAbsPath);
  // 去掉扩展名（.js）
  const noExt = rel.slice(0, -extname(rel).length);
  return join(srcRoot, noExt + ".ts");
}

function classifyReason(missingPath) {
  // 横切服务（4 中心）
  if (missingPath.includes(`${sep}services${sep}horizontal${sep}`)) return "horizontal-service";
  // 横切服务 oauth 子目录
  if (missingPath.includes(`${sep}horizontal${sep}oauth${sep}`)) return "horizontal-oauth";
  // module-domain 业务模块
  if (missingPath.includes(`${sep}services${sep}module-domain${sep}`)) return "module-domain";
  // http router
  if (missingPath.includes(`${sep}http${sep}`)) return "http-router";
  // 类型定义
  if (missingPath.includes(`${sep}types${sep}`)) return "types";
  // 顶层 services
  if (missingPath.includes(`${sep}services${sep}`)) return "services";
  return "other";
}

const all = await walk(distRoot);
const jsFiles = all.filter((p) => p.endsWith(".js") && !p.endsWith(".d.ts") && !p.endsWith(".js.map"));

const missing = [];
for (const js of jsFiles) {
  const expectedTs = expectedTsForJs(js);
  try {
    const s = await stat(expectedTs);
    if (!s.isFile()) {
      missing.push({ js, expectedTs, reason: classifyReason(expectedTs), note: "src 路径存在但不是文件" });
    }
  } catch {
    missing.push({ js, expectedTs, reason: classifyReason(expectedTs), note: "src 源文件不存在" });
  }
}

// 按 reason 分组
const grouped = new Map();
for (const m of missing) {
  if (!grouped.has(m.reason)) grouped.set(m.reason, []);
  grouped.get(m.reason).push(m);
}

// 排序
const order = ["module-domain", "horizontal-service", "horizontal-oauth", "http-router", "types", "services", "other"];
grouped.forEach((arr) => arr.sort((a, b) => a.expectedTs.localeCompare(b.expectedTs)));

// 输出
const totalMissing = missing.length;
const totalJs = jsFiles.length;
const totalCovered = totalJs - totalMissing;
const coverage = totalJs === 0 ? 100 : Math.round((totalCovered / totalJs) * 1000) / 10;

console.log(`# src/dist 源文件覆盖检查`);
console.log();
console.log(`- 扫描根目录：${root}`);
console.log(`- dist 中 .js 文件总数：${totalJs}`);
console.log(`- src 中已存在对应 .ts：${totalCovered}`);
console.log(`- **需要恢复：${totalMissing}**`);
console.log(`- 覆盖率：${coverage}%`);
console.log();
console.log(`## 分组清单`);
console.log();
for (const key of order) {
  const arr = grouped.get(key);
  if (!arr || arr.length === 0) continue;
  const label = {
    "module-domain": "业务模块（module-domain/）",
    "horizontal-service": "4 中心横切服务（horizontal/）",
    "horizontal-oauth": "OAuth 子目录（horizontal/oauth/）",
    "http-router": "HTTP 路由（http/）",
    "types": "类型定义（types/）",
    "services": "顶层 services/ 业务",
    "other": "其他",
  }[key];
  console.log(`### ${label}（${arr.length}）`);
  console.log();
  console.log("| dist .js | 期望 src .ts | 备注 |");
  console.log("|----------|---------------|------|");
  for (const m of arr) {
    const jsRel = relative(root, m.js).replaceAll(sep, "/");
    const tsRel = relative(root, m.expectedTs).replaceAll(sep, "/");
    console.log(`| ${jsRel} | ${tsRel} | ${m.note} |`);
  }
  console.log();
}

// 退出码：CI 友好
if (totalMissing > 0) {
  console.log(`> ⚠️  有 ${totalMissing} 个源文件需要恢复。`);
  process.exit(0); // 不阻塞，作为信息输出
}
