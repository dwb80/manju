import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "dist", "data", "coverage", ".next", "test-results"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".env", ".example"]);
const patterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "hard-coded bearer token", regex: /Authorization\s*[:=]\s*["'`]Bearer\s+[A-Za-z0-9._-]{24,}["'`]/i },
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    if (entry.isFile() && entry.name === ".env") continue; // runtime-only, gitignored; CI scans committed examples/source
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name.startsWith(".env")) files.push(target);
  }
  return files;
}

const findings = [];
for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  if (/package-lock\.json$/.test(relative) || /security-p0\.test\.mjs$/.test(relative) || relative === "scripts\\check-secrets.mjs") continue;
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of patterns) if (pattern.regex.test(line)) findings.push(`${relative}:${index + 1}: ${pattern.name}`);
  });
}

if (findings.length > 0) {
  console.error("Secret scan failed (values redacted):\n" + findings.join("\n"));
  process.exit(1);
}
console.log("Secret scan passed.");
