import { createServer } from "node:http";
import next from "next";

process.env.AGNES_BACKEND_URL = "http://127.0.0.1:3000";
process.env.NEXT_PUBLIC_AGNES_BACKEND_URL = "http://127.0.0.1:3000";

const app = next({ dev: false, dir: process.cwd() });
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => handle(req, res));

server.listen(3101, "127.0.0.1", () => {
  console.log("Agnes AI Studio E2E frontend listening on http://127.0.0.1:3101");
});

const shutdown = () => {
  server.close(() => void app.close().finally(() => process.exit(0)));
  const forcedExit = setTimeout(() => process.exit(0), 2_000);
  forcedExit.unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
