import { createServer } from "./src/http/router.js";
import { createAppContext } from "./src/services/app.js";
import { loadEnv } from "./src/config/env.js";
import { pathToFileURL } from "node:url";

/** 创建应用上下文并启动 HTTP 服务，是后端进程的主入口。 */
export function startServer(port = Number(process.env.PORT ?? 3000)) {
  loadEnv(process.cwd());
  const ctx = createAppContext(process.cwd());
  const server = createServer(ctx);
  server.listen(port, () => {
    console.log(`Agnes AI Studio listening on http://localhost:${port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
