/** 剧本中心服务 */

import { analyzeScriptContent } from "@/components/modules/scripts-center/utils";

const API_BASE = '/api'

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
      throw new Error('AI优化剧本失败')
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
   * AI 分析剧本内容（与 ScriptImportDialog 走同一套逻辑）
   *
   * 1. 优先调用后端大模型（POST /api/ai/script-analyze），50s 超时
   * 2. AI 失败/超时时回退到本地正则分析（analyzeScriptContent）
   * 3. 返回的字段对齐 store 入库格式：
   *    - characters[].name / .description
   *    - scenes[].location_name / .time_of_day / .description
   *    - props[].name / .category / .description
   *    - episodes[].episode_no / .title / .synopsis
   */
  analyzeScript: async (content: string): Promise<{
    source: 'ai' | 'local'
    characters: Array<{ name: string; description: string; traits: string[] }>
    scenes: Array<{ location_name: string; time_of_day: string; description: string }>
    props: Array<{ name: string; category: string; description: string }>
    episodes: Array<{ episode_no: number; title: string; synopsis: string }>
    warnings?: string[]
  }> => {
    // 1) 优先调用大模型
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50_000);
      const resp = await fetch(`${API_BASE}/ai/script-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format: 'txt' }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const payload = await resp.json();
        const data = payload?.data ?? payload;
        return {
          source: 'ai',
          characters: data.characters ?? [],
          scenes: data.scenes ?? data.sceneAssets ?? [],
          props: data.props ?? data.propAssets ?? [],
          episodes: data.episodes ?? [],
          warnings: data.warnings ?? [],
        };
      }
      console.warn(`AI 分析失败 HTTP ${resp.status}, 回退到本地正则`);
    } catch (err) {
      console.warn('AI 分析异常, 回退到本地正则:', err);
    }

    // 2) 兜底：本地正则分析
    const localAssets = analyzeScriptContent(content);
    const localCharacters = localAssets
      .filter((a) => a.type === 'character')
      .map((a) => ({
        name: a.name,
        description: a.description ?? '',
        traits: a.traits ?? [],
      }));
    const localScenes = localAssets
      .filter((a) => a.type === 'scene')
      .map((a) => ({
        location_name: a.name,
        time_of_day: (a as any).timeOfDay ?? 'unknown',
        description: a.description ?? '',
      }));
    const localProps = localAssets
      .filter((a) => a.type === 'prop')
      .map((a) => ({
        name: a.name,
        category: (a as any).category ?? 'other',
        description: a.description ?? '',
      }));

    return {
      source: 'local',
      characters: localCharacters,
      scenes: localScenes,
      props: localProps,
      episodes: [], // 本地正则无法识别剧集边界
      warnings: ['已回退到本地正则分析，剧集未自动切分'],
    };
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
      throw new Error('获取评论失败')
    }
    const payload = await response.json()
    return (payload?.data ?? payload) as ScriptComment[]
  },

  /** 创建评论或回复（reply 场景下传 parentId） */
  createComment: async (data: Partial<ScriptComment> & { scriptId: string; content: string }): Promise<ScriptComment> => {
    const response = await fetch(`${API_BASE}/script-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('创建评论失败')
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
      throw new Error('更新评论失败')
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
      throw new Error('删除评论失败')
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