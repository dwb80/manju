import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(root, "frontend", ".next");
const frontend = path.resolve(root, "frontend");

if (!target.startsWith(`${frontend}${path.sep}`)) {
  throw new Error(`Refusing to remove unexpected path: ${target}`);
}

await rm(target, { recursive: true, force: true });
console.log(`[frontend] Cleaned ${target}`);
