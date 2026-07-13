/** 剧本中心服务 */

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

  /** 获取剧本列表 */
  getDocuments: async (): Promise<ScriptDocument[]> => {
    const response = await fetch(`${API_BASE}/script-documents`)
    if (!response.ok) {
      throw new Error('获取剧本列表失败')
    }
    return response.json()
  },

  /** 创建剧本文档 */
  createDocument: async (data: Partial<ScriptDocument>): Promise<ScriptDocument> => {
    const response = await fetch(`${API_BASE}/script-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('创建剧本文档失败')
    }
    return response.json()
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
   */
  analyzeScript: async (
    content: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{
    source: 'ai'
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
    // 外部 signal 与内部 50s 超时合并：任一触发即中止
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
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
        body: JSON.stringify({ content, format: 'txt' }),
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

    // 归一化角色字段：后端 AI 已返回 role/gender/appearance/personality/traits
    const characters = (data.characters ?? []).map((c: any) => ({
      name: c.name || '',
      description: c.description || '',
      role: c.role,
      gender: c.gender,
      age: c.age,
      appearance: c.appearance,
      personality: c.personality,
      traits: Array.isArray(c.traits) ? c.traits : [],
    }))

    return {
      source: 'ai',
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
}
