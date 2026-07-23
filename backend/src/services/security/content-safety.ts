import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";

const BLOCKED_PATTERNS: Array<{ category: "nsfw" | "violence" | "illegal"; pattern: RegExp }> = [
  { category: "nsfw", pattern: /(?:色情|成人视频|裸露未成年人|sexual\s+content|child\s+porn)/i },
  { category: "violence", pattern: /(?:血腥虐杀|肢解教程|massacre\s+instructions|graphic\s+gore)/i },
  { category: "illegal", pattern: /(?:制毒教程|枪支制造|诈骗话术|洗钱教程|make\s+a\s+bomb)/i },
];

export class ContentSafetyError extends Error {
  readonly status = 422;
  readonly code = "content_policy_violation";
  constructor(readonly categories: string[]) {
    super("内容违反安全策略，已阻止处理");
    this.name = "ContentSafetyError";
  }
}

export async function assertTextSafe(ctx: AppContext, text: string, stage: "input" | "output", resourceId = ""): Promise<void> {
  const categories: string[] = BLOCKED_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.category);
  const scan = await ctx.sensitiveWordService.check(text);
  const severeWords = scan.words.filter((word) => Number(word.severity) >= 3);
  if (severeWords.length > 0) categories.push(...severeWords.map((word) => `sensitive:${word.category}`));
  if (categories.length === 0) return;
  const unique = [...new Set(categories)];
  rootLogger.warn({ event: "security.ai_content_blocked", stage, resourceId, categories: unique }, "AI 内容安全门禁已阻止请求");
  throw new ContentSafetyError(unique);
}

export function assertMediaInputsSafe(items: Array<{ name?: string; type?: string; url?: string; size?: number }>): void {
  for (const item of items) {
    const type = item.type?.toLowerCase() ?? "";
    if (type && !/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(type)) {
      throw new ContentSafetyError(["unsupported_media"]);
    }
    if ((item.size ?? 0) > 200 * 1024 * 1024) throw new ContentSafetyError(["oversized_media"]);
    const label = `${item.name ?? ""} ${item.url ?? ""}`;
    const matches = BLOCKED_PATTERNS.filter((entry) => entry.pattern.test(label)).map((entry) => entry.category);
    if (matches.length > 0) throw new ContentSafetyError(matches);
  }
}

export async function assertAiPayloadSafe(ctx: AppContext, payload: unknown, stage: "input" | "output", resourceId = ""): Promise<void> {
  const texts: string[] = [];
  const media: Array<{ name?: string; type?: string; url?: string; size?: number }> = [];
  const visit = (value: unknown, key = ""): void => {
    if (typeof value === "string" && /(?:prompt|message|content|script|description|title|negative)/i.test(key)) texts.push(value);
    else if (Array.isArray(value)) for (const item of value) visit(item, key);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.url === "string" || typeof record.type === "string") media.push(record as typeof media[number]);
      for (const [childKey, item] of Object.entries(record)) visit(item, childKey);
    }
  };
  visit(payload);
  assertMediaInputsSafe(media);
  for (const text of texts) await assertTextSafe(ctx, text, stage, resourceId);
}
