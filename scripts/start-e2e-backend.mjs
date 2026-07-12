import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "../backend/dist/src/http/router.js";
import { createAppContext } from "../backend/dist/src/services/app.js";

const root = path.resolve(process.cwd(), ".e2e-data");
const port = Number(process.env.PORT ?? 3100);

// E2E 启动脚本：必须使用真实 AGNES_API_KEY（从 .env 读取）
// 如未配置 API Key，将由 createAgnesClient 抛错，启动失败 —— 这是预期行为
if (!process.env.AGNES_API_KEY) {
  console.warn("[E2E] AGNES_API_KEY 未配置；所有 AI 接口将返回错误。请在 .env 中配置真实 Key。");
}

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
