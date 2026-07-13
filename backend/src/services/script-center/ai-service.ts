/**
 * AI 剧本生成服务
 *
 * - generateScriptWithAI: AI 生成剧本大纲
 * - optimizeScriptWithAI: AI 优化/扩写剧本
 * - generateSceneWithAI: AI 生成场景
 * - generateDialogueWithAI: AI 生成对白
 * - splitStoryboardWithAI: AI 分镜拆分
 */

import type { AppContext } from "../app.js";
import type {
  AIDialogueGenerationRequest,
  AISceneGenerationRequest,
  AIScriptGenerationRequest,
  AIScriptOptimizationRequest,
  AIStoryboardSplitRequest,
  ScriptDialogue,
  ScriptScene,
} from "../../types.js";
import { executeModelCall, recommendModels } from "../model-center-impl.js";
import { createBackup } from "./backup-service.js";
import { createScriptDialogue } from "./dialogue-service.js";
import { createScriptDocument, updateScriptDocument } from "./document-service.js";
import { createScriptScene } from "./scene-service.js";
import { collectChatContent } from "./utils.js";

export async function generateScriptWithAI(
  ctx: AppContext,
  userId: string,
  request: AIScriptGenerationRequest
): Promise<{ content: string }> {
  // 推荐最适合的模型
  const recommendations = await recommendModels(ctx, {
    task_type: "script_generation",
    quality_requirement: "high",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "script_generation",
    async () => {
      // 这里调用实际的AI生成接口
      const prompt = buildScriptGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "script-gen",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 文档模式：创建剧本文档；纯文本模式：仅返回内容
  if (request.project_id) {
    await createScriptDocument(ctx, {
      project_id: request.project_id,
      editor_json: JSON.stringify({ content: result }),
      version: 1,
    });
  }

  return { content: result };
}

function buildScriptGenerationPrompt(request: AIScriptGenerationRequest): string {
  let prompt = `请根据以下要求生成一个剧本大纲：\n\n`;
  prompt += `提示词：${request.prompt}\n`;

  if (request.style) prompt += `风格：${request.style}\n`;
  if (request.genre) prompt += `类型：${request.genre}\n`;
  if (request.length) prompt += `长度：约${request.length}字\n`;
  if (request.characters && request.characters.length > 0) {
    prompt += `角色：${request.characters.join("、")}\n`;
  }
  if (request.settings && request.settings.length > 0) {
    prompt += `设定：${request.settings.join("、")}\n`;
  }

  prompt += `\n请以结构化的方式输出剧本，包括场景描述、角色对白和情节发展。`;

  return prompt;
}

export async function optimizeScriptWithAI(
  ctx: AppContext,
  userId: string,
  request: AIScriptOptimizationRequest
): Promise<{ optimizedContent: string }> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "script_optimization",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 纯文本模式：直接使用 request.content 作为原文
  const isTextMode = !request.script_id && !!request.content;
  let originalText = request.content || "";

  if (!isTextMode) {
    // 文档模式：从数据库读取原文
    const document = await ctx.scriptDocuments.findById(request.script_id!);
    if (!document) throw new Error("剧本不存在");
    originalText = typeof document.editor_json === "string"
      ? document.editor_json
      : JSON.stringify(document.editor_json);
  }

  // 执行AI优化
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "script_optimization",
    async () => {
      const prompt = buildScriptOptimizationPrompt(originalText, request);
      const chunks = await ctx.ai.chat({
        conversationId: "script-opt",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 文档模式：更新剧本文档并创建备份
  if (!isTextMode && request.script_id) {
    await updateScriptDocument(ctx, request.script_id, {
      editor_json: JSON.stringify({ content: result }),
    });
    if (request.project_id) {
      await createBackup(ctx, request.project_id, request.script_id, "auto", userId);
    }
  }

  return { optimizedContent: result };
}

function buildScriptOptimizationPrompt(
  originalText: string,
  request: AIScriptOptimizationRequest
): string {
  let prompt = `你是一个剧本润色/扩写助手。请对用户给出的剧本片段进行改写。\n\n`;
  prompt += `【严格规则】\n`;
  prompt += `1. 只输出改写/扩写后的内容本身，不要复述、引用或重复原文\n`;
  prompt += `2. 不要输出任何解释、前言、元说明、标题、Markdown 标题（如"剧本大纲""核心冲突"等）\n`;
  prompt += `3. 不要输出 JSON 格式或代码块\n`;
  prompt += `4. 输出长度要明显大于或等于原文，如果是扩写则至少为原文的 1.5 倍\n`;
  prompt += `5. 保持原文的人物、情节和叙事视角，只在表达上做丰富\n\n`;
  prompt += `【优化类型】${request.optimization_type || "style"}（扩写=更详细具体的场景描写、心理活动、环境渲染；优化=更精炼有力的表达）\n\n`;

  if (request.custom_instructions) {
    prompt += `【特别要求】${request.custom_instructions}\n\n`;
  }

  prompt += `【原文】\n${originalText}\n\n`;
  prompt += `【改写后内容】\n`;

  return prompt;
}

export async function generateSceneWithAI(
  ctx: AppContext,
  userId: string,
  request: AISceneGenerationRequest
): Promise<ScriptScene> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "scene_generation",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "scene_generation",
    async () => {
      const prompt = buildSceneGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "scene-gen",
        message: prompt,
        model: selectedModel,
      });

      const content = await collectChatContent(chunks);
      return JSON.parse(content);
    }
  );

  // 创建场景记录
  const scene = await createScriptScene(ctx, {
    project_id: request.project_id,
    episode_id: request.episode_id,
    scene_no: result.scene_no ?? 1,
    location_name: result.location_name ?? request.location ?? "",
    time_of_day: result.time_of_day ?? "day",
    description: result.description ?? request.scene_description,
    notes: result.notes ?? "",
  });

  return scene;
}

function buildSceneGenerationPrompt(request: AISceneGenerationRequest): string {
  let prompt = `请根据以下要求生成一个场景描述：\n\n`;
  prompt += `场景描述：${request.scene_description}\n`;

  if (request.characters && request.characters.length > 0) {
    prompt += `出场角色：${request.characters.join("、")}\n`;
  }
  if (request.location) prompt += `地点：${request.location}\n`;
  if (request.mood) prompt += `氛围：${request.mood}\n`;

  prompt += `\n请以JSON格式输出，包含以下字段：scene_no, location_name, time_of_day, description, notes`;

  return prompt;
}

export async function generateDialogueWithAI(
  ctx: AppContext,
  userId: string,
  request: AIDialogueGenerationRequest
): Promise<ScriptDialogue> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "dialogue_generation",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "dialogue_generation",
    async () => {
      const prompt = buildDialogueGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "dialogue-gen",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 创建对白记录
  const dialogue = await createScriptDialogue(ctx, {
    project_id: request.project_id,
    scene_id: request.scene_id,
    character_id: request.character_id,
    dialogue: result,
    emotion: request.emotion ?? "",
    order: 0,
  });

  return dialogue;
}

function buildDialogueGenerationPrompt(request: AIDialogueGenerationRequest): string {
  let prompt = `请为角色生成一段对白：\n\n`;
  prompt += `角色ID：${request.character_id}\n`;

  if (request.context) prompt += `上下文：${request.context}\n`;
  if (request.emotion) prompt += `情感：${request.emotion}\n`;
  if (request.style) prompt += `风格：${request.style}\n`;

  prompt += `\n请直接输出对白内容，不要包含其他说明文字。`;

  return prompt;
}

export async function splitStoryboardWithAI(
  ctx: AppContext,
  userId: string,
  request: AIStoryboardSplitRequest
): Promise<{ storyboards: string[] }> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "storyboard_split",
    quality_requirement: "high",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 纯文本模式：直接使用 request.content；文档模式：从数据库读取
  const isTextMode = !request.script_id && !!request.content;
  let originalText = request.content || "";

  if (!isTextMode) {
    const document = await ctx.scriptDocuments.findById(request.script_id!);
    if (!document) throw new Error("剧本不存在");
    originalText = typeof document.editor_json === "string"
      ? document.editor_json
      : JSON.stringify(document.editor_json);
  }

  // 执行AI拆分
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "storyboard_split",
    async () => {
      const prompt = buildStoryboardSplitPrompt(originalText, request);
      const chunks = await ctx.ai.chat({
        conversationId: "storyboard-split",
        message: prompt,
        model: selectedModel,
      });

      const content = await collectChatContent(chunks);
      // 尝试解析JSON，失败则按行拆分
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.scenes)) return parsed;
        if (Array.isArray(parsed.storyboards)) return { storyboards: parsed.storyboards };
        return { storyboards: [content] };
      } catch {
        return { storyboards: content.split(/\n+/).filter((l: string) => l.trim()) };
      }
    }
  );

  // 文档模式：创建场景记录
  const storyboards: string[] = [];
  if (Array.isArray(result.scenes)) {
    for (const sceneData of result.scenes) {
      const desc = sceneData.description || sceneData.location_name || `场景${sceneData.scene_no || ""}`;
      storyboards.push(desc);
      if (request.project_id) {
        await createScriptScene(ctx, {
          project_id: request.project_id,
          scene_no: sceneData.scene_no,
          location_name: sceneData.location_name,
          time_of_day: sceneData.time_of_day,
          description: sceneData.description,
          notes: sceneData.notes ?? "",
        });
      }
    }
  } else if (Array.isArray(result.storyboards)) {
    storyboards.push(...result.storyboards);
  }

  return { storyboards };
}

function buildStoryboardSplitPrompt(
  originalText: string,
  request: AIStoryboardSplitRequest
): string {
  let prompt = `请将以下剧本拆分为分镜场景：\n\n`;
  prompt += `剧本内容：\n${originalText}\n\n`;
  prompt += `拆分策略：${request.split_strategy || "scene"}\n`;
  prompt += `详细程度：${request.detail_level || "standard"}\n`;

  prompt += `\n请以JSON格式输出，格式为：{ "scenes": [{ scene_no, location_name, time_of_day, description, notes }] }`;

  return prompt;
}
