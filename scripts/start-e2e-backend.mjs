import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "../backend/dist/src/http/router.js";
import { createAppContext } from "../backend/dist/src/services/app.js";

const root = path.resolve(process.cwd(), ".e2e-data");
const port = Number(process.env.PORT ?? 3100);

process.env.AGNES_USE_REAL_API = "false";

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const server = createServer(createAppContext(root, { mediaCacheEnabled: false }));

server.listen(port, () => {
  console.log(`Agnes AI Studio E2E backend listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
