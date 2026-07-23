import { spawn } from "node:child_process";

const child = spawn(process.execPath, process.argv.slice(2), {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "test",
    ENDPOINT_WRITE_RATE_LIMIT: process.env.ENDPOINT_WRITE_RATE_LIMIT ?? "10000",
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`node test process terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
