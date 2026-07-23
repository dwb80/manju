/**
 * @file sensitive-word-service.ts
 * @description 敏感词库服务（带 5s 进程内缓存），为审核 / 发布 / 聊天提供内容前置检查。
 *
 * ## 设计要点
 *  - 5 秒缓存：避免每次 chat() 都全表扫描（典型词量 100-1000）。
 *  - 命中按 severity 倒序：高危词排在前面便于前端分级处理。
 *  - 增 / 删 / 改都会 invalidate 缓存，避免脏读。
 *
 * ## 表结构
 *  - sensitive_words(id, word, category, severity, enabled, created_at, created_by)
 */
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { SensitiveWord, SensitiveWordCategory, SensitiveWordSeverity } from "../../types/horizontal.js";

const log = rootLogger.child({ module: "sensitive-word-service" });

/** 缓存有效期：5 秒。 */
const CACHE_TTL_MS = 5_000;

interface CacheState {
  loadedAt: number;
  words: SensitiveWord[];
}

let cache: CacheState | null = null;

function isCacheFresh(c: CacheState | null): c is CacheState {
  return c !== null && Date.now() - c.loadedAt < CACHE_TTL_MS;
}

export interface SensitiveCheckResult {
  hit: boolean;
  words: SensitiveWord[];
}

export interface SensitiveWordService {
  listAll(): Promise<SensitiveWord[]>;
  add(input: {
    word: string;
    category: SensitiveWordCategory;
    severity: SensitiveWordSeverity;
    enabled?: boolean;
    created_by?: string;
  }): Promise<SensitiveWord>;
  remove(id: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  check(text: string): Promise<SensitiveCheckResult>;
  invalidate(): void;
}

export function createSensitiveWordService(ctx: AppContext): SensitiveWordService {
  async function loadEnabledFromDb(): Promise<SensitiveWord[]> {
    const all = await ctx.sensitiveWords.findMany({});
    return all.filter((w) => w.enabled);
  }

  async function getCacheWords(): Promise<SensitiveWord[]> {
    if (isCacheFresh(cache)) {
      return cache.words;
    }
    const words = await loadEnabledFromDb();
    cache = { loadedAt: Date.now(), words };
    log.debug({ count: words.length }, "敏感词缓存已刷新");
    return words;
  }

  return {
    async listAll() {
      return await ctx.sensitiveWords.findMany({});
    },

    async add(input) {
      const existing = await ctx.sensitiveWords.findOne({ word: input.word });
      if (existing) {
        log.info({ word: input.word }, "敏感词已存在，跳过新增");
        return existing;
      }
      const record: SensitiveWord = {
        id: crypto.randomUUID(),
        word: input.word,
        category: input.category,
        severity: input.severity,
        enabled: input.enabled ?? true,
        created_at: new Date().toISOString(),
        created_by: input.created_by,
      };
      await ctx.sensitiveWords.insert(record);
      cache = null;
      log.info({ word: input.word, category: input.category, severity: input.severity }, "敏感词新增");
      return record;
    },

    async remove(id) {
      const record = await ctx.sensitiveWords.findById(id);
      if (!record) {
        return false;
      }
      await ctx.sensitiveWords.delete(id);
      cache = null;
      log.info({ id, word: record.word }, "敏感词删除");
      return true;
    },

    async setEnabled(id, enabled) {
      await ctx.sensitiveWords.update(id, { enabled });
      cache = null;
    },

    async check(text) {
      if (!text || text.length === 0) {
        return { hit: false, words: [] };
      }
      const words = await getCacheWords();
      const hits: SensitiveWord[] = [];
      for (const w of words) {
        if (text.includes(w.word)) {
          hits.push(w);
        }
      }
      // 命中按 severity 降序
      hits.sort((a, b) => b.severity - a.severity);
      return { hit: hits.length > 0, words: hits };
    },

    invalidate() {
      cache = null;
    },
  };
}
