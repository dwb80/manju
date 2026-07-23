import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const backendRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(backendRoot, "src");
const baseline = JSON.parse(
  await readFile(path.join(import.meta.dirname, "ddd-write-baseline.json"), "utf8"),
);
const violations = [];
const observed = new Map();
const protectedWrite =
  /\b(?:ctx\.)?(?:pipelineRuns|pipelineNodes|shots)\.(?:insert|update|delete)\s*\(|\b(?:ctx\.)?reviews\.update\s*\(|(?:UPDATE|INSERT\s+INTO|REPLACE\s+INTO|DELETE\s+FROM)\s+(?:pipeline_runs|pipeline_nodes|shots|reviews|review_items)\b/gi;
const protectedReviewFields =
  /\b(?:status|version|rejected_count|rejection_reason|rejection_reason_code|approved_at|submitted_by|reviewed_by|re_submit_count|previous_review_id|chain_id)\b/i;

function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(absolute);
  }
  return files;
}

function relative(absolute) {
  return path.relative(backendRoot, absolute).replaceAll("\\", "/");
}

function permanentlyWhitelisted(relativePath) {
  return relativePath.startsWith("src/infrastructure/persistence/")
    || relativePath.startsWith("src/migrations/")
    || relativePath === "src/services/module-domain/error-recovery.ts";
}

for (const absolute of await walk(sourceRoot)) {
  const relativePath = relative(absolute);
  const text = await readFile(absolute, "utf8");
  const source = withoutComments(text);
  const matches = [...source.matchAll(protectedWrite)];
  for (const call of source.matchAll(/\breviewItems\.update\s*\(([\s\S]*?)\);/g)) {
    if (protectedReviewFields.test(call[1])) matches.push(call);
  }
  if (matches.length > 0 && !permanentlyWhitelisted(relativePath)) {
    observed.set(relativePath, matches.length);
    const allowedLegacyCount = Number(baseline[relativePath] ?? 0);
    if (matches.length > allowedLegacyCount) {
      violations.push(
        `${relativePath}: protected Repository writes=${matches.length}, legacy ceiling=${allowedLegacyCount}`,
      );
    }
  }

  if (relativePath.startsWith("src/domain/")) {
    const forbiddenImport =
      /from\s+["'][^"']*(?:\/http\/|\/storage\/|services\/app|\/ai\/)[^"']*["']/;
    if (forbiddenImport.test(text)) {
      violations.push(
        `${relativePath}: Domain code must not depend on HTTP, storage, AppContext, or AI providers`,
      );
    }
  }
}

for (const [relativePath, count] of Object.entries(baseline)) {
  const current = observed.get(relativePath) ?? 0;
  if (current < count) {
    console.log(
      `DDD migration progress: ${relativePath} protected writes ${count} -> ${current}`,
    );
  }
}

if (violations.length > 0) {
  console.error("V2.1 DDD boundary gate failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  const total = [...observed.values()].reduce((sum, value) => sum + value, 0);
  console.log(`V2.1 DDD boundary gate passed (legacy protected writes: ${total}).`);
}
