import { createConnection } from "node:net";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function localMalwareCheck(bytes: Buffer): void {
  const head = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (bytes.includes(Buffer.from(EICAR)) || head.subarray(0, 2).toString("ascii") === "MZ" || head.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error("上传内容命中恶意文件或可执行文件特征");
  }
  const preview = head.toString("utf8").toLowerCase();
  if (preview.includes("<script") || preview.includes("<?php") || preview.includes("#!/bin/")) throw new Error("上传内容命中脚本型恶意载荷");
}

async function scanWithClamAv(bytes: Buffer, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    let reply = "";
    const timer = setTimeout(() => socket.destroy(new Error("ClamAV 扫描超时")), 15_000);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 64 * 1024));
        const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length);
        socket.write(length); socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => { reply += chunk.toString("utf8"); });
    socket.on("error", reject);
    socket.on("close", () => {
      clearTimeout(timer);
      if (/FOUND/i.test(reply)) reject(new Error("上传文件未通过 ClamAV 病毒扫描"));
      else if (/OK/i.test(reply)) resolve();
      else reject(new Error(`ClamAV 返回异常：${reply.slice(0, 120) || "empty response"}`));
    });
  });
}

export async function scanUploadForMalware(bytes: Buffer): Promise<void> {
  localMalwareCheck(bytes);
  const host = process.env.CLAMAV_HOST?.trim();
  const required = process.env.UPLOAD_AV_REQUIRED === "true" || (process.env.NODE_ENV === "production" && process.env.UPLOAD_AV_REQUIRED !== "false");
  if (host) return scanWithClamAv(bytes, host, Number(process.env.CLAMAV_PORT ?? 3310));
  if (required) throw new Error("生产环境上传要求配置 CLAMAV_HOST，或由风险负责人显式设置 UPLOAD_AV_REQUIRED=false");
}
