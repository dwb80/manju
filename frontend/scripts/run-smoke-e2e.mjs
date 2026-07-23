import { spawn } from "node:child_process";
import path from "node:path";

const cli = path.resolve("node_modules", "@playwright", "test", "cli.js");
const specs = [
  "tests/e2e/app.spec.ts",
  "tests/e2e/modules-keypath-e2e.spec.ts",
  "tests/e2e/minimum-viewport.spec.ts",
];

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} 失败（code=${code}, signal=${signal ?? "none"}）`)));
  });
}

const backendRoot = path.resolve("..", "backend");
const skipBuild = process.env.E2E_SKIP_BUILD === "1" || process.argv.includes("--skip-build");
if (!skipBuild) {
  await run(process.execPath, [path.join(backendRoot, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(backendRoot, "tsconfig.json")], backendRoot);
  await run(process.execPath, [path.resolve("node_modules", "next", "dist", "bin", "next"), "build"], process.cwd(), {
    AGNES_BACKEND_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_AGNES_BACKEND_URL: "http://127.0.0.1:3000",
  });
}

function start(command, args, cwd, extraEnv = {}) {
  return spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: "inherit", shell: false });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`服务启动超时: ${url}`);
}

const backend = start(process.execPath, [path.resolve("..", "scripts", "start-e2e-backend.mjs")], backendRoot, { PORT: "3000" });
const frontend = start(process.execPath, [path.resolve("scripts", "start-e2e-frontend.mjs")], process.cwd());
try {
  await Promise.all([
    waitForUrl("http://127.0.0.1:3000/api/health"),
    waitForUrl("http://127.0.0.1:3101"),
  ]);
  await run(process.execPath, [cli, "test", ...specs, "--reporter=line"], process.cwd(), { E2E_EXTERNAL_SERVERS: "1" });
} finally {
  frontend.kill("SIGTERM");
  backend.kill("SIGTERM");
}
