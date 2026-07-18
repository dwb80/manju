import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "../backend/dist/src/http/router.js";
import { createAppContext } from "../backend/dist/src/services/app.js";
import { FakeAIClient } from "../backend/dist/src/ai/fake-ai-client.js";

const root = path.resolve(process.cwd(), ".e2e-data");
const port = Number(process.env.PORT ?? 3100);

// E2E 显式注入确定性 FakeAIClient：不访问外网、不消费真实额度。

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const ctx = await createAppContext(root, { mediaCacheEnabled: false, aiClient: new FakeAIClient() });
const server = createServer(ctx);

server.listen(port, "127.0.0.1", () => {
  console.log(`Agnes AI Studio E2E backend listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => {
    ctx.close();
    void rm(root, { recursive: true, force: true }).finally(() => process.exit(0));
  });
  const forcedExit = setTimeout(() => process.exit(0), 2_000);
  forcedExit.unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
