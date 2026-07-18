/**
 * @file script-center.service.ts
 * @description 剧本中心服务模块，提供剧本文档、剧集、场景的完整 CRUD 及 AI 分析功能
 */

const API_BASE = '/api'

/**
 * 从后端错误响应里提取对用户友好的提示。
 * 后端统一返回 `{ code, message, data: null }`，这里优先用它的 message，
 * 再把那些一看就是给开发者的报错（带下划线字段名、堆栈痕迹）翻译成大白话。
 */
async function extractApiError(response: Response, fallback: string): Promise<string> {
  let backendMessage = ''
  try {
    const body = await response.clone().json()
    if (body && typeof body.message === 'string' && body.message.trim()) {
      backendMessage = body.message.trim()
    }
  } catch {
    // 响应体不是 JSON 或为空，忽略
  }

  if (!backendMessage) {
    return fallback
  }

  // 把后端面向开发者的字段校验错误转成用户能看懂的提示
  const fieldErrorMap: Record<string, string> = {
    'script_id 不能为空': '无法添加评论：缺少剧本信息，请刷新页面后重试',
    '评论内容不能为空': '评论内容不能为空',
    'parent_id 不能为空': '回复失败：找不到要回复的评论',
    '评论不存在': '操作失败：评论已被删除',
  }
  for (const [developerText, friendlyText] of Object.entries(fieldErrorMap)) {
    if (backendMessage.includes(developerText)) {
      return friendlyText
    }
  }

  // 500 之类的服务端错误，避免把堆栈信息直接甩给用户
  if (response.status >= 500) {
    return '服务器开小差了，请稍后再试'
  }

  return backendMessage
}

// 分析提取的资产类型
// 字段命名与工厂表（Character / Scene / Prop）完全对齐：
//   - Character: tags、identity / face / hair / body / temperament / costume_* / accessories
//   - Scene: type（替代 scene_type，兼容回退）、category / indoor_outdoor / location / architecture / ...
//   - Prop: appearance / size / importance_level / owner / shape / texture / ...
// 字段缺失或工厂独占字段（image / usage_count / version / deleted_at / project_id+script_id 工厂专用列）
// 由前端按需补默认值。
interface ScriptAnalyzedCharacter {
  id: string
  document_id: string
  project_id: string
  name: string
  role: string
  gender: string
  age: string
  description: string
  appearance: string
  personality: string
  traits: string[]
  /** 工厂标签（与 factory Character.tags 对齐；存量数据可能为空，故 optional） */
  tags?: string[]
  factory_character_id?: string
  status: 'extracted' | 'confirmed' | 'transferred'
  created_at: string
  updated_at: string

  // === AI 剧本分析扩展字段（与 Character 表对齐） ===
  identity?: string
  face?: string
  hair?: string
  body?: string
  temperament?: string
  costume_name?: string
  costume_description?: string
  costume_color?: string
  costume_material?: string
  costume_style?: string
  accessories?: string[]
  emotion_states?: string
  action_assets?: string
  relationships?: string
  first_appearance?: string
  dialogue_count?: number
  generation_prompt?: string
  confidence?: string
}

interface ScriptAnalyzedScene {
  id: string
  document_id: string
  project_id: string
  name: string
  /** 场景类型：indoor / outdoor / virtual（与 factory Scene.type 字段名一致；存量数据可能为空，故 optional） */
  type?: string
  /** 兼容旧字段：保留以读取历史数据；新写入请用 type */
  scene_type?: string
  description: string
  lighting: string
  time_of_day: string
  weather: string
  /** 工厂标签（与 factory Scene.tags 对齐；存量数据可能为空，故 optional） */
  tags?: string[]
  factory_scene_id?: string
  status: 'extracted' | 'confirmed' | 'transferred'
  created_at: string
  updated_at: string

  // === AI 剧本分析扩展字段（与 Scene 表对齐） ===
  category?: string
  indoor_outdoor?: string
  location?: string
  architecture?: string
  terrain?: string
  plants?: string
  objects?: string
  period?: string
  tone?: string
  visual_style?: string
  atmosphere_emotion?: string
  suitable_shots?: string
  reusable_elements?: string
  generation_prompt?: string
  first_appearance?: string
  confidence?: string
}

interface ScriptAnalyzedProp {
  id: string
  document_id: string
  project_id: string
  name: string
  category: string
  description: string
  /** 外观造型（与 factory Prop.appearance 对齐；存量数据可能为空，故 optional） */
  appearance?: string
  material: string
  /** 尺寸（与 factory Prop.size 对齐；存量数据可能为空，故 optional） */
  size?: string
  color: string
  /** 工厂标签（与 factory Prop.tags 对齐；存量数据可能为空，故 optional） */
  tags?: string[]
  factory_prop_id?: string
  status: 'extracted' | 'confirmed' | 'transferred'
  created_at: string
  updated_at: string

  // === AI 剧本分析扩展字段（与 Prop 表对齐） ===
  importance_level?: string
  owner?: string
  shape?: string
  texture?: string
  story_function?: string
  visual_features?: string
  camera_usage?: string
  generation_prompt?: string
  first_appearance?: string
  confidence?: string
}

// 类型定义
interface ScriptDocument {
  id: string
  project_id?: string
  title: string
  author: string
  status: 'draft' | 'active' | 'review' | 'completed' | 'archived'
  description?: string
  editor_json: any
  words?: number
  chapters?: number
  /** 完整 AI 分析数据（导入时持久化，导入后可在剧本编辑器中查看） */
  ai_raw_data?: string
  created_at: string
  updated_at: string
  version: number
}

interface ScriptEpisode {
  id: string
  documentId: string
  episodeNo: number
  title: string
  synopsis?: string
  status: string
  scenes: ScriptScene[]
  created_at: string
  updated_at: string
}

interface ScriptScene {
  id: string
  episodeId: string
  location: string
  time: string
  description?: string
  status: string
  created_at: string
  updated_at: string
}

interface AIScriptGenerationRequest {
  prompt: string
  style?: string
  genre?: string
  length?: number
  project_id?: string
}

interface AIScriptOptimizationRequest {
  script_id?: string
  optimization_type?: 'grammar' | 'style' | 'dialogue' | 'structure' | 'pacing'
  content?: string
  project_id?: string
  custom_instructions?: string
}

interface AISceneGenerationRequest {
  location: string
  time: string
  mood?: string
  characters?: string[]
}

interface AIDialogueGenerationRequest {
  character: string
  emotion: string
  context?: string
  length?: number
}

interface AIStoryboardSplitRequest {
  script_id?: string
  content?: string
  project_id?: string
  split_strategy?: 'scene' | 'shot' | 'beat'
  detail_level?: 'basic' | 'standard' | 'detailed'
}

// 剧本评论（与后端 ScriptComment 字段一一对应）
interface ScriptComment {
  id: string
  script_id: string
  episode_id?: string
  user_name: string
  content: string
  selected_text: string
  position_from: number
  position_to: number
  parent_id?: string
  resolved: boolean
  created_at: string
  updated_at: string
}

// 剧本中心服务
export const scriptCenterService = {
  // ========== 剧本文档管理 ==========

  /** 获取剧本文档 */
  getDocument: async (id: string): Promise<{ document: ScriptDocument; episodes: ScriptEpisode[]; scenes: ScriptScene[] }> => {
    const response = await fetch(`${API_BASE}/script-documents/${id}`)
    if (!response.ok) {
      throw new Error('获取剧本文档失败')
    }
    return response.json()
  },

  /** 获取剧本列表（支持按项目过滤） */
  getDocuments: async (projectId?: string): Promise<ScriptDocument[]> => {
    const url = projectId
      ? `${API_BASE}/script-documents?projectId=${encodeURIComponent(projectId)}`
      : `${API_BASE}/script-documents`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('获取剧本列表失败');
    }
    // 方案 A 修复：后端用 sendJson 统一包装为 { code, message, data }，
    // 这里必须取 .data，否则调用方拿到的就是包装对象，scripts.filter 会报错。
    const payload = await response.json();
    return (payload?.data ?? payload) as ScriptDocument[];
  },

  /** 创建剧本文档 */
  createDocument: async (data: Partial<ScriptDocument>): Promise<ScriptDocument> => {
    const body = { ...data }
    if (body.editor_json && typeof body.editor_json !== 'string') {
      body.editor_json = JSON.stringify(body.editor_json) as any
    }
    const response = await fetch(`${API_BASE}/script-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error('创建剧本文档失败')
    }
    const payload = await response.json()
    return (payload?.data ?? payload) as ScriptDocument
  },

  /** 更新剧本文档 */
  updateDocument: async (id: string, data: Partial<ScriptDocument>): Promise<ScriptDocument> => {
    const body = { ...data }
    if (body.editor_json && typeof body.editor_json !== 'string') {
      body.editor_json = JSON.stringify(body.editor_json) as any
    }
    const response = await fetch(`${API_BASE}/script-documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error('更新剧本文档失败')
    }
    return response.json()
  },

  /** 删除剧本文档 */
  deleteDocument: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/script-documents/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除剧本文档失败')
    }
  },

  /** 获取回收站列表（已软删剧本文档） */
  listDeletedDocuments: async (projectId?: string): Promise<ScriptDocument[]> => {
    const url = projectId
      ? `${API_BASE}/script-documents?projectId=${encodeURIComponent(projectId)}&deleted=1`
      : `${API_BASE}/script-documents?deleted=1`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('获取回收站列表失败');
    }
    const payload = await response.json();
    return (payload?.data ?? payload) as ScriptDocument[];
  },

  /** 恢复已软删的剧本文档 */
  restoreDocument: async (id: string): Promise<ScriptDocument> => {
    const response = await fetch(`${API_BASE}/script-documents/${id}/restore`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('恢复剧本文档失败');
    }
    return response.json();
  },

  /** 彻底删除剧本文档（需软删≥30天） */
  purgeDocument: async (id: string): Promise<{ document_id: string; deleted_at: string; purged_at: string; grace_days: number; cascade: Record<string, number> }> => {
    const response = await fetch(`${API_BASE}/script-documents/${id}/purge`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('彻底删除剧本文档失败');
    }
    return response.json();
  },

  // ========== 剧集管理 ==========

  /** 获取剧集列表 */
  getEpisodes: async (documentId: string): Promise<ScriptEpisode[]> => {
    const response = await fetch(`${API_BASE}/script-episodes?documentId=${documentId}`)
    if (!response.ok) {
      throw new Error('获取剧集列表失败')
    }
    return response.json()
  },

  /** 创建剧集 */
  createEpisode: async (data: Partial<ScriptEpisode>): Promise<ScriptEpisode> => {
    const response = await fetch(`${API_BASE}/script-episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('创建剧集失败')
    }
    return response.json()
  },

  /** 更新剧集 */
  updateEpisode: async (id: string, data: Partial<ScriptEpisode>): Promise<ScriptEpisode> => {
    const response = await fetch(`${API_BASE}/script-episodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('更新剧集失败')
    }
    return response.json()
  },

  /** 删除剧集 */
  deleteEpisode: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/script-episodes/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除剧集失败')
    }
  },

  // ========== 场景管理 ==========

  /** 获取场景列表 */
  getScenes: async (episodeId: string): Promise<ScriptScene[]> => {
    const response = await fetch(`${API_BASE}/script-scenes?episodeId=${episodeId}`)
    if (!response.ok) {
      throw new Error('获取场景列表失败')
    }
    return response.json()
  },

  /** 创建场景 */
  createScene: async (data: Partial<ScriptScene>): Promise<ScriptScene> => {
    const response = await fetch(`${API_BASE}/script-scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('创建场景失败')
    }
    return response.json()
  },

  /** 更新场景 */
  updateScene: async (id: string, data: Partial<ScriptScene>): Promise<ScriptScene> => {
    const response = await fetch(`${API_BASE}/script-scenes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('更新场景失败')
    }
    return response.json()
  },

  /** 删除场景 */
  deleteScene: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/script-scenes/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除场景失败')
    }
  },

  // ========== AI功能 ==========

  /** AI生成剧本 */
  generateScript: async (params: AIScriptGenerationRequest): Promise<{ content: string }> => {
    const response = await fetch(`${API_BASE}/ai/script-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      throw new Error('AI生成剧本失败')
    }
    const payload = await response.json()
    return payload?.data ?? payload
  },

  /** AI优化剧本 */
  optimizeScript: async (params: AIScriptOptimizationRequest): Promise<{ optimizedContent: string }> => {
    const response = await fetch(`${API_BASE}/ai/script-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      let message = 'AI优化剧本失败'
      try {
        const payload = await response.json()
        if (payload?.message) message = payload.message
      } catch {
        // ignore
      }
      throw new Error(message)
    }
    const payload = await response.json()
    return payload?.data ?? payload
  },

  /** AI生成场景 */
  generateScene: async (params: AISceneGenerationRequest): Promise<{ description: string }> => {
    const response = await fetch(`${API_BASE}/ai/scene-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      throw new Error('AI生成场景失败')
    }
    return response.json()
  },

  /** AI生成对话 */
  generateDialogue: async (params: AIDialogueGenerationRequest): Promise<{ dialogue: string }> => {
    const response = await fetch(`${API_BASE}/ai/dialogue-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      throw new Error('AI生成对话失败')
    }
    return response.json()
  },

  /** AI分镜拆分 */
  splitStoryboard: async (params: AIStoryboardSplitRequest): Promise<{ storyboards: string[] }> => {
    const response = await fetch(`${API_BASE}/ai/storyboard-split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      throw new Error('AI分镜拆分失败')
    }
    const payload = await response.json()
    return payload?.data ?? payload
  },

  // ========== 导入导出 ==========

  /** 导出剧本（仅支持JSON格式） */
  exportScript: async (id: string, format: 'json' | 'markdown' | 'fdx'): Promise<Blob> => {
    // 目前只支持JSON格式导出
    if (format !== 'json') {
      throw new Error('目前仅支持JSON格式导出')
    }

    const response = await fetch(`${API_BASE}/script-export/${id}`)
    if (!response.ok) {
      throw new Error('导出剧本失败')
    }
    return response.blob()
  },

  /** 导入剧本（仅支持JSON格式） */
  importScript: async (projectId: string, jsonData: string): Promise<ScriptDocument> => {
    const response = await fetch(`${API_BASE}/script-import/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json_data: jsonData }),
    })
    if (!response.ok) {
      throw new Error('导入剧本失败')
    }
    const payload = await response.json()
    return payload?.data ?? payload
  },

  // ========== AI 分析 ==========

  /**
   * AI 分析剧本内容（走大模型，不使用正则兜底）
   *
   * 行为：
   *   1) 始终调用大模型（POST /api/ai/script-analyze）
   *   2) 用户主动中止（signal.aborted）→ 抛 AbortError，由调用方处理
   *   3) 后端返回 success:false（AI 失败 / 输出无法解析）→ 抛 Error，让前端弹错
   *   4) 后端返回 success:true → 归一化字段后返回
   *
   * @param content - 待分析的剧本文本
   * @param options.signal - 可选 AbortSignal，用于用户主动取消
   * @param options.timeoutMs - 前端 AbortController 超时（毫秒），同时透传到后端覆盖 AI_TIMEOUTS.analyzeScript
   *   默认 180_000（180s）。后端默认也是 180s，环境变量 AGNES_TIMEOUT_ANALYZE_SCRIPT_MS 可覆盖。
   * @param options.model - 可选大模型 id（不传则后端走 DEFAULT_MODEL = "agnes-2.0-flash"）。
   *   返回值里 `model` 字段为后端回填的"实际使用模型"，与请求透传的 model 一致（或为默认值）。
   */
  analyzeScript: async (
    content: string,
    options: { signal?: AbortSignal; timeoutMs?: number; model?: string } = {},
  ): Promise<{
    source: 'ai'
    /** 实际使用的大模型 id（如 "agnes-2.0-flash"），UI 用这个展示"使用 xxx 解析成功" */
    model: string
    characters: Array<{
      name: string
      description: string
      role?: string
      gender?: string
      age?: number
      appearance?: string
      personality?: string
      traits: string[]
    }>
    scenes: Array<{ location_name: string; time_of_day: string; description: string }>
    props: Array<{ name: string; category: string; description: string }>
    episodes: Array<{ episode_no: number; title: string; synopsis: string }>
    warnings?: string[]
  }> => {
    // 默认 180s；后端会再做一次"用 timeoutMs 还是 AI_TIMEOUTS.analyzeScript"的解析
    const timeoutMs = options.timeoutMs ?? 180_000;
    // 外部 signal 与内部 timeoutMs 合并：任一触发即中止
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }
    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/ai/script-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // options.model 透传给后端：非空字符串才传；空/undefined 让后端走 DEFAULT_MODEL
        body: JSON.stringify({
          content,
          format: 'txt',
          timeoutMs,
          ...(typeof options.model === 'string' && options.model.trim() ? { model: options.model.trim() } : {}),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);
    }

    // 解析响应（统一捕获 JSON 解析错误）
    let payload: any;
    try {
      payload = await resp.json();
    } catch (e) {
      throw new Error(`AI 分析响应无法解析 (HTTP ${resp.status})`);
    }

    // 后端用 success 字段标识是否成功
    if (payload?.success === false) {
      throw new Error(payload?.error || `AI 分析失败 (HTTP ${resp.status})`);
    }
    if (!resp.ok && payload?.success !== true) {
      throw new Error(`AI 分析失败 (HTTP ${resp.status})`);
    }

    const data = payload?.data ?? payload;
    if (!data) {
      throw new Error('AI 分析返回数据为空');
    }

    // 归一化角色字段：后端 AI 返回的是嵌套结构（basic / appearance / costume ...），
    // 但下游 useScriptAnalyze.apply 和 CharacterDetailModal.analyzePreviewCharacter
    // 都按"扁平结构"读 c.role / c.gender / c.age / c.appearance / c.traits，
    // 这里必须把嵌套字段正确摊平，否则会出现：
    //   1) 年龄识别了 28 但写库成 0（c.age 取不到 → 落空字符串/0）
    //   2) 性别 / 角色定位都是 undefined
    //   3) 外貌 / 性格 字段被传成 [object Object]
    const characters = (data.characters ?? []).map((c: any) => {
      // 年龄：AI 原始是字符串 ("28" / "少年" / "中年")，尝试解析为数字。
      // 解析失败（"少年" 等描述性词）→ 留 undefined，让下游自己决定
      const ageRaw = c?.basic?.age
      const ageNum =
        ageRaw !== undefined && ageRaw !== null && ageRaw !== ''
          ? typeof ageRaw === 'number'
            ? ageRaw
            : parseInt(String(ageRaw), 10) || undefined
          : undefined

      // 外貌：AI 返回 {face, hair, body, temperament} 对象，需要拼成可读字符串
      const ap = c?.appearance
      const appearanceStr =
        ap && typeof ap === 'object'
          ? [ap.face, ap.hair, ap.body, ap.temperament].filter(Boolean).join('；')
          : typeof ap === 'string'
            ? ap
            : ''

      // 性格：AI 用 personality_keywords（字符串数组），前端扁平模型字段是 personality
      const personalityKeywords = Array.isArray(c?.personality_keywords) ? c.personality_keywords : []
      const personalityStr = personalityKeywords.join('、')

      return {
        name: c?.name || '',
        // 描述：AI 没有顶层 description，用 generation_prompt（中文摘要）兜底
        description: c?.description || c?.generation_prompt || '',
        role: c?.basic?.role_type,
        gender: c?.basic?.gender,
        age: ageNum,
        appearance: appearanceStr,
        personality: personalityStr,
        traits: personalityKeywords,
      }
    })

    return {
      source: 'ai',
      // 后端会回填"实际使用的模型 id"；若后端未回填（极旧版本），回落为 options.model，都没有则空串
      model: String(data.model || options.model || '').trim(),
      characters,
      scenes: data.scenes ?? data.sceneAssets ?? [],
      props: data.props ?? data.propAssets ?? [],
      episodes: data.episodes ?? [],
      warnings: data.warnings ?? [],
    }
  },

  /** 获取版本历史 */
  getVersionHistory: async (documentId: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/script-versions/${documentId}`)
    if (!response.ok) {
      throw new Error('获取版本历史失败')
    }
    return response.json()
  },

  /** 恢复版本 */
  restoreVersion: async (documentId: string, versionId: string): Promise<ScriptDocument> => {
    const response = await fetch(`${API_BASE}/script-backups/${versionId}/restore`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('恢复版本失败')
    }
    return response.json()
  },

  // ========== 版本对比 ==========
  /** 对比两个版本 */
  compareVersions: async (documentId: string, versionId1: string, versionId2: string): Promise<{ diff: any }> => {
    const response = await fetch(
      `${API_BASE}/script-documents/${documentId}/compare?version1=${versionId1}&version2=${versionId2}`
    )
    if (!response.ok) {
      throw new Error('版本对比失败')
    }
    return response.json()
  },

  // ========== 剧本流转 ==========
  /** 提交审批 */
  submitForApproval: async (scriptId: string, message?: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/script-approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_id: scriptId, status: 'pending', comments: message ? [{ comment: message }] : [] }),
    })
    if (!response.ok) {
      throw new Error('提交审批失败')
    }
    return response.json()
  },

  /** 检查审批状态 */
  checkApprovalStatus: async (scriptId: string): Promise<{ status: string; comments: any[] }> => {
    const response = await fetch(`${API_BASE}/script-approvals/${scriptId}`)
    if (!response.ok) {
      throw new Error('获取审批状态失败')
    }
    return response.json()
  },

  /** 流转到生产环节 */
  transferToProduction: async (scriptId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/script-documents/${scriptId}/transfer-production`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('流转到生产环节失败')
    }
    return response.json()
  },

  // ========== 分镜拆解导出 ==========
  /** 导出为分镜格式 */
  exportToStoryboard: async (scriptId: string, episodeId?: string): Promise<{ storyboards: any[] }> => {
    const response = await fetch(`${API_BASE}/script-export/${scriptId}/storyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodeId }),
    })
    if (!response.ok) {
      throw new Error('导出分镜失败')
    }
    return response.json()
  },

  // ========== 分析提取资产 ==========
  /** 获取剧本分析提取的资产 */
  getAnalyzedAssets: async (documentId: string): Promise<{
    characters: ScriptAnalyzedCharacter[]
    scenes: ScriptAnalyzedScene[]
    props: ScriptAnalyzedProp[]
  }> => {
    const response = await fetch(`${API_BASE}/script-documents/${documentId}/analyzed-assets`)
    if (!response.ok) {
      throw new Error('获取分析资产失败')
    }
    // 后端 sendJson 统一包成 { code, message, data }，必须解包 data
    // 否则 `assets.characters` 是 undefined，map 会抛错被外层 catch 吞掉，
    // 页面始终显示 "提取 0/0/0" 的空状态，无法复用已分析结果。
    const payload = await response.json()
    return (payload?.data ?? payload) as {
      characters: ScriptAnalyzedCharacter[]
      scenes: ScriptAnalyzedScene[]
      props: ScriptAnalyzedProp[]
    }
  },

  /** 保存剧本分析提取的资产（全量替换） */
  saveAnalyzedAssets: async (
    documentId: string,
    projectId: string,
    assets: {
      characters: Omit<ScriptAnalyzedCharacter, 'id' | 'document_id' | 'project_id' | 'created_at' | 'updated_at'>[]
      scenes: Omit<ScriptAnalyzedScene, 'id' | 'document_id' | 'project_id' | 'created_at' | 'updated_at'>[]
      props: Omit<ScriptAnalyzedProp, 'id' | 'document_id' | 'project_id' | 'created_at' | 'updated_at'>[]
    }
  ): Promise<{
    characters: ScriptAnalyzedCharacter[]
    scenes: ScriptAnalyzedScene[]
    props: ScriptAnalyzedProp[]
  }> => {
    const response = await fetch(`${API_BASE}/script-documents/${documentId}/analyzed-assets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, ...assets }),
    })
    if (!response.ok) {
      throw new Error('保存分析资产失败')
    }
    return response.json()
  },

  /** 更新分析角色状态（如流转到工厂后） */
  updateAnalyzedCharacter: async (id: string, data: Partial<ScriptAnalyzedCharacter>): Promise<ScriptAnalyzedCharacter> => {
    const response = await fetch(`${API_BASE}/analyzed-characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('更新分析角色失败')
    }
    return response.json()
  },

  /** 更新分析场景状态 */
  updateAnalyzedScene: async (id: string, data: Partial<ScriptAnalyzedScene>): Promise<ScriptAnalyzedScene> => {
    const response = await fetch(`${API_BASE}/analyzed-scenes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('更新分析场景失败')
    }
    return response.json()
  },

  /** 更新分析道具状态 */
  updateAnalyzedProp: async (id: string, data: Partial<ScriptAnalyzedProp>): Promise<ScriptAnalyzedProp> => {
    const response = await fetch(`${API_BASE}/analyzed-props/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('更新分析道具失败')
    }
    return response.json()
  },

  /** 删除分析角色（硬删：仅从当前剧本的视图移除，不影响工厂资源） */
  deleteAnalyzedCharacter: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/analyzed-characters/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除分析角色失败')
    }
  },

  /** 删除分析场景（硬删：仅从当前剧本的视图移除，不影响工厂资源） */
  deleteAnalyzedScene: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/analyzed-scenes/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除分析场景失败')
    }
  },

  /** 删除分析道具（硬删：仅从当前剧本的视图移除，不影响工厂资源） */
  deleteAnalyzedProp: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/analyzed-props/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除分析道具失败')
    }
  },

  // ========== AI评分与分析 ==========
  /** 获取AI评分 */
  getAIAssessment: async (scriptId: string): Promise<{
    overall: number
    dimensions: Array<{
      name: string
      score: number
      weight: number
      suggestions: string[]
    }>
    summary: string
  }> => {
    const response = await fetch(`${API_BASE}/script-assessments/${scriptId}`)
    if (!response.ok) {
      throw new Error('获取AI评分失败')
    }
    return response.json()
  },

  /** 生成AI评分 */
  generateAIAssessment: async (scriptId: string): Promise<{ assessmentId: string }> => {
    const response = await fetch(`${API_BASE}/script-assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId }),
    })
    if (!response.ok) {
      throw new Error('生成AI评分失败')
    }
    return response.json()
  },

  // ========== 连续性检查 ==========
  /** 检查连续性 */
  checkContinuity: async (scriptId: string): Promise<{
    issues: Array<{
      type: 'character' | 'scene' | 'timeline' | 'prop'
      severity: 'error' | 'warning'
      message: string
      location: string
      suggestion?: string
    }>
  }> => {
    const response = await fetch(`${API_BASE}/script-checks/${scriptId}/continuity`)
    if (!response.ok) {
      throw new Error('连续性检查失败')
    }
    return response.json()
  },

  // ========== 标签管理 ==========
  /** 获取标签列表 */
  getTags: async (scriptId: string): Promise<Array<{ id: string; name: string; color: string }>> => {
    const response = await fetch(`${API_BASE}/script-tags?scriptId=${scriptId}`)
    if (!response.ok) {
      throw new Error('获取标签失败')
    }
    return response.json()
  },

  /** 添加标签 */
  addTag: async (scriptId: string, tag: { name: string; color: string }): Promise<{ id: string }> => {
    const response = await fetch(`${API_BASE}/script-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_id: scriptId, name: tag.name, color: tag.color }),
    })
    if (!response.ok) {
      throw new Error('添加标签失败')
    }
    return response.json()
  },

  /** 删除标签 */
  removeTag: async (scriptId: string, tagId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/script-tags/${tagId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除标签失败')
    }
  },

  // ========== 剧本统计 ==========
  /** 获取剧本统计 */
  getStatistics: async (scriptId: string): Promise<{
    totalWords: number
    totalScenes: number
    totalCharacters: number
    totalDialogues: number
    characterFrequency: Array<{ name: string; count: number }>
    sceneDistribution: Array<{ location: string; count: number }>
    pacingData: Array<{ position: number; intensity: number }>
  }> => {
    const response = await fetch(`${API_BASE}/script-documents/${scriptId}/statistics`)
    if (!response.ok) {
      throw new Error('获取统计数据失败')
    }
    return response.json()
  },

  // ========== 审批流程 ==========
  /** 获取审批流程 */
  getApprovalWorkflow: async (scriptId: string): Promise<{
    steps: Array<{
      id: string
      name: string
      order: number
      status: 'pending' | 'approved' | 'rejected'
      approver?: string
      comment?: string
      timestamp?: string
    }>
    currentStep: number
  }> => {
    const response = await fetch(`${API_BASE}/script-approvals/${scriptId}`)
    if (!response.ok) {
      throw new Error('获取审批流程失败')
    }
    return response.json()
  },

  /** 执行审批操作 */
  performApprovalAction: async (
    scriptId: string,
    stepId: string,
    action: 'approve' | 'reject',
    comment?: string
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/script-approvals/${stepId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_id: scriptId, status: action, comments: comment ? [{ action, comment }] : [] }),
    })
    if (!response.ok) {
      throw new Error('审批操作失败')
    }
    return response.json()
  },

  // ========== 评论批注 ==========
  /** 拉取剧本文档的全部评论（含回复） */
  getComments: async (scriptId: string): Promise<ScriptComment[]> => {
    const response = await fetch(`${API_BASE}/script-comments?scriptId=${encodeURIComponent(scriptId)}`)
    if (!response.ok) {
      throw new Error(await extractApiError(response, '获取评论失败'))
    }
    const payload = await response.json()
    return (payload?.data ?? payload) as ScriptComment[]
  },

  /** 创建评论或回复（reply 场景下传 parent_id） */
  createComment: async (data: Partial<ScriptComment> & { script_id: string; content: string }): Promise<ScriptComment> => {
    const response = await fetch(`${API_BASE}/script-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error(await extractApiError(response, '创建评论失败'))
    }
    const payload = await response.json()
    return (payload?.data ?? payload) as ScriptComment
  },

  /** 局部更新评论（解决 / 取消解决 / 修改内容） */
  updateComment: async (id: string, data: Partial<ScriptComment>): Promise<ScriptComment> => {
    const response = await fetch(`${API_BASE}/script-comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error(await extractApiError(response, '更新评论失败'))
    }
    const payload = await response.json()
    return (payload?.data ?? payload) as ScriptComment
  },

  /** 删除评论（前端会顺带清理孤儿回复） */
  deleteComment: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/script-comments/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(await extractApiError(response, '删除评论失败'))
    }
  },
}

// 导出类型
export type {
  ScriptDocument,
  ScriptEpisode,
  ScriptScene,
  AIScriptGenerationRequest,
  AIScriptOptimizationRequest,
  AISceneGenerationRequest,
  AIDialogueGenerationRequest,
  AIStoryboardSplitRequest,
  ScriptComment,
  ScriptAnalyzedCharacter,
  ScriptAnalyzedScene,
  ScriptAnalyzedProp,
}
