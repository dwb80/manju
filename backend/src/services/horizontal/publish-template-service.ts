/**
 * @file publish-template-service.ts
 * @description 发布平台模板服务。把 `{title}` `{character}` 等占位符渲染成平台专属文案。
 *
 * ## 设计要点
 *  - 模板用 `{key}` 占位符，缺失值时**保留原占位符**（避免渲染出空字符串）。
 *  - renderFor 在没找到模板时返回空串 + warn，调用方按需降级。
 *  - 5 平台 × 3 物料（title / cover / intro）共 15 条记录。
 *
 * ## 表结构
 *  - publish_templates(id, platform, content_type, template, created_by, updated_by, created_at, updated_at)
 */
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { PublishTemplate, PublishContentType } from "../../types/horizontal.js";

const log = rootLogger.child({ module: "publish-template-service" });

export type Platform = "xiaohongshu" | "douyin" | "bilibili" | "weixin_video" | "weibo";

export interface TemplateVars {
  title?: string;
  intro?: string;
  character?: string;
  character_name?: string;
  episode_no?: number | string;
  platform_tag?: string;
  [key: string]: unknown;
}

export interface PublishTemplateService {
  getTemplate(platform: Platform, contentType: PublishContentType): Promise<PublishTemplate | null>;
  render(template: string, vars: TemplateVars): string;
  renderFor(platform: Platform, contentType: PublishContentType, vars: TemplateVars): Promise<string>;
}

export function createPublishTemplateService(ctx: AppContext): PublishTemplateService {
  function render(template: string, vars: TemplateVars): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const v = vars[key];
      if (v === undefined || v === null || v === "") return match;
      return String(v);
    });
  }

  return {
    async getTemplate(platform, contentType) {
      const existing = await ctx.publishTemplates.findOne({
        platform,
        content_type: contentType,
      });
      return existing;
    },

    render,

    async renderFor(platform, contentType, vars) {
      const tpl = await ctx.publishTemplates.findOne({ platform, content_type: contentType });
      if (!tpl) {
        log.warn({ platform, contentType }, "未找到发布模板");
        return "";
      }
      return render(tpl.template, vars);
    },
  };
}
