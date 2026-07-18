import { createServer } from "./src/http/router.js";
import { createAppContext } from "./src/services/app.js";
import { loadEnv } from "./src/config/env.js";
import { pathToFileURL } from "node:url";

/**
 * 跨平台中文日志支持 —— 解决乱码 ?? 问题
 *
 * 三大环境分别需要做不同的事，缺一不可：
 *
 * 1) Windows：默认代码页是 CP936/GBK，必须
 *    - chcp 65001（启动脚本里做，见 start-backend.bat）
 *    - process.stdout.setDefaultEncoding("utf8")（这里做）
 *    - 否则 write UTF-8 字节会被按系统代码页解码成 ??
 *
 * 2) macOS / Linux：终端默认就是 UTF-8，但
 *    - 部分容器（alpine、centos-minimal）没装 zh_CN.UTF-8 locale
 *    - 如果当前 LANG 是 zh_CN 但没装，glibc 抛 "unknown locale"
 *    - 这里把 LANG / LC_ALL 兜底设为 C.UTF-8（POSIX 必装，不会崩）
 *
 * 3) 容器/SSH：保持 LANG 已设值；只有"未设"时才覆盖，避免影响用户自定义。
 *
 * 备注：仅影响 process.stdout / process.stderr / Node 进程的 locale 派生。
 *      文件写入（fs.writeFile 等）默认就是按 buffer 写，不会被转码。
 */
try {
  if (typeof process.stdout.setDefaultEncoding === "function") {
    process.stdout.setDefaultEncoding("utf8");
  }
  if (typeof process.stderr.setDefaultEncoding === "function") {
    process.stderr.setDefaultEncoding("utf8");
  }
  // 兜底 locale：仅在用户没设时补 C.UTF-8；已设的不动，避免破坏用户配置
  if (!process.env.LANG) process.env.LANG = "C.UTF-8";
  if (!process.env.LC_ALL) process.env.LC_ALL = "C.UTF-8";
} catch {
  // 任何一步失败都不阻塞启动
}

/** 创建应用上下文并启动 HTTP 服务，是后端进程的主入口。 */
export function startServer(
  port = Number(process.env.PORT ?? 3000),
  host = process.env.HOST?.trim() || "127.0.0.1",
) {
  loadEnv(process.cwd());
  // createAppContext 是 async：需要先建 ctx 再 listen。这里在同步流程里 fire-and-forget，
  // 若 setup 失败会 throw 到 process.on('unhandledRejection')。
  void (async () => {
    const ctx = await createAppContext(process.cwd());
    const server = createServer(ctx);
    server.listen(port, host, () => {
      // 启动横幅：中文，方便运维一眼确认
      console.log(`[manju-backend] 监听 http://${host}:${port}（日志级别=${process.env.LOG_LEVEL ?? "info"}）`);
    });
  })();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
