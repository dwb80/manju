import { create } from 'zustand'

// 类型定义
interface ScriptDocument {
  id: string
  project_id: string  // 添加项目ID
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
  notes?: string
  status: string
  created_at: string
  updated_at: string
}

interface ScriptCharacter {
  id: string
  name: string
  assetId?: string
  description?: string
  color: string
  thumbnail?: string
}

interface ScriptVersion {
  id: string
  version: number
  timestamp: string
  changes: string
  author?: string
  content: any
}

// 状态接口
interface ScriptState {
  currentDocument: ScriptDocument | null
  episodes: ScriptEpisode[]
  scenes: ScriptScene[]
  characters: ScriptCharacter[]
  versions: ScriptVersion[]
  selectedEpisode: string | null
  selectedScene: string | null
  isSaving: boolean
  lastSavedAt: string | null
  isLoading: boolean
  error: string | null

  // Actions
  loadDocument: (id: string) => Promise<void>
  saveDocument: () => Promise<void>
  createEpisode: (data: Partial<ScriptEpisode>) => Promise<void>
  updateEpisode: (id: string, data: Partial<ScriptEpisode>) => Promise<void>
  deleteEpisode: (id: string) => Promise<void>
  createScene: (episodeId: string, data: Partial<ScriptScene>) => Promise<void>
  updateScene: (id: string, data: Partial<ScriptScene>) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  selectEpisode: (id: string | null) => void
  selectScene: (id: string | null) => void
  addCharacter: (character: ScriptCharacter) => void
  removeCharacter: (id: string) => void
  loadVersions: () => Promise<void>
  restoreVersion: (versionId: string) => Promise<void>
  deleteVersion: (versionId: string) => Promise<void>
  setError: (error: string | null) => void
  reset: () => void
}

// API 基础路径
const API_BASE = '/api'

// 创建状态存储
export const useScriptStore = create<ScriptState>((set, get) => ({
  // 初始状态
  currentDocument: null,
  episodes: [],
  scenes: [],
  characters: [],
  versions: [],
  selectedEpisode: null,
  selectedScene: null,
  isSaving: false,
  lastSavedAt: null,
  isLoading: false,
  error: null,

  // 加载剧本文档
  loadDocument: async (docId: string) => {
    set({ isLoading: true, error: null })
    try {
      // 后端统一响应格式为 { code, message, data }，需要解包
      // 1. 先获取所有模块 Script 列表，用于查找元数据（title 等）
      const scriptResponse = await fetch(`${API_BASE}/scripts`)
      const scriptPayload = scriptResponse.ok ? await scriptResponse.json() : null
      const scripts: any[] = scriptPayload?.data ?? []
      const moduleScript = scripts.find((s: any) => s.id === docId) || null

      // 2. 尝试加载 ScriptDocument（编辑器内容）
      const docResponse = await fetch(`${API_BASE}/script-documents/${docId}`)
      let doc: any = null
      if (docResponse.ok) {
        const docPayload = await docResponse.json()
        doc = docPayload?.data ?? null
      }

      // 3. ScriptDocument 不存在但有模块 Script → 创建对应的 ScriptDocument
      if (!doc && moduleScript) {
        const createResponse = await fetch(`${API_BASE}/script-documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: moduleScript.id,
            project_id: moduleScript.project_id,
            editor_json: JSON.stringify({
              type: 'doc',
              content: [{ type: 'paragraph', content: moduleScript.description ? [{ type: 'text', text: moduleScript.description }] : [] }],
            }),
            version: 1,
          }),
        })
        if (createResponse.ok) {
          const createPayload = await createResponse.json()
          doc = createPayload?.data ?? null
        }
      }

      if (doc) {
        // 合并 ScriptDocument（编辑器内容）与 Script 模块（元数据）
        // 后端 editor_json 是 string，前端编辑器需要 object
        let editorJson: any = doc.editor_json
        if (typeof editorJson === 'string') {
          try {
            editorJson = JSON.parse(editorJson)
          } catch {
            editorJson = { type: 'doc', content: [{ type: 'paragraph' }] }
          }
        }
        const projectId = moduleScript?.project_id || doc.project_id || ''
        // 加载该剧本对应的剧集列表
        let loadedEpisodes: ScriptEpisode[] = []
        try {
          const epResponse = await fetch(`${API_BASE}/script-episodes?projectId=${projectId}`)
          if (epResponse.ok) {
            const epPayload = await epResponse.json()
            const rawEpisodes: any[] = epPayload?.data ?? []
            loadedEpisodes = rawEpisodes.map((ep) => ({
              ...ep,
              episodeNo: ep.episode_no,
              documentId: ep.document_id,
              scenes: [],
            }))
          }
        } catch {
          // 剧集加载失败不阻塞编辑器
        }
        // 加载所有场景并按 episode_id 分组挂到剧集上
        let loadedScenes: ScriptScene[] = []
        try {
          const scResponse = await fetch(`${API_BASE}/script-scenes?projectId=${projectId}`)
          if (scResponse.ok) {
            const scPayload = await scResponse.json()
            const rawScenes: any[] = scPayload?.data ?? []
            loadedScenes = rawScenes.map((sc) => ({
              ...sc,
              episodeId: sc.episode_id,
              location: sc.location_name,
              time: sc.time_of_day,
            }))
          }
        } catch {
          // 场景加载失败不阻塞编辑器
        }
        // 将场景挂到对应剧集下
        loadedEpisodes = loadedEpisodes.map((ep) => ({
          ...ep,
          scenes: loadedScenes.filter((sc) => sc.episodeId === ep.id),
        }))
        set({
          currentDocument: {
            ...moduleScript,
            ...doc,
            id: doc.id,
            editor_json: editorJson,
          },
          episodes: loadedEpisodes,
          scenes: loadedScenes,
          isLoading: false,
        })
        return
      }

      throw new Error(moduleScript ? '创建剧本文档失败' : '剧本不存在或已删除')
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 保存剧本文档
  saveDocument: async () => {
    const { currentDocument } = get()
    if (!currentDocument) return

    set({ isSaving: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-documents/${currentDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentDocument.project_id,
          editor_json: typeof currentDocument.editor_json === 'string'
            ? currentDocument.editor_json
            : JSON.stringify(currentDocument.editor_json),
          version: currentDocument.version,
        }),
      })
      if (!response.ok) {
        throw new Error('保存剧本文档失败')
      }
      const payload = await response.json()
      const updatedDoc = payload?.data ?? null
      set({
        currentDocument: updatedDoc
          ? { ...currentDocument, ...updatedDoc }
          : currentDocument,
        isSaving: false,
        lastSavedAt: new Date().toISOString(),
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isSaving: false,
      })
    }
  },

  // 创建剧集
  createEpisode: async (data: Partial<ScriptEpisode>) => {
    const { currentDocument } = get()
    if (!currentDocument) return

    set({ isLoading: true, error: null })
    try {
      const projectId = currentDocument.project_id || ''
      // 后端路由：POST /api/script-episodes，字段用 snake_case
      const response = await fetch(`${API_BASE}/script-episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          document_id: currentDocument.id,
          episode_no: data.episodeNo ?? (get().episodes.length + 1),
          title: data.title ?? '',
          synopsis: data.synopsis ?? '',
          status: data.status ?? 'draft',
        }),
      })
      if (!response.ok) {
        throw new Error('创建剧集失败')
      }
      const episodePayload = await response.json()
      const episode = episodePayload?.data
      if (!episode) throw new Error('创建剧集失败')
      // 映射后端 snake_case 到前端 camelCase
      const mapped: ScriptEpisode = {
        ...episode,
        episodeNo: episode.episode_no,
        documentId: episode.document_id,
      }
      set({
        episodes: [...get().episodes, mapped],
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 更新剧集
  updateEpisode: async (id: string, data: Partial<ScriptEpisode>) => {
    set({ isLoading: true, error: null })
    try {
      const body: Record<string, any> = {}
      if (data.title !== undefined) body.title = data.title
      if (data.synopsis !== undefined) body.synopsis = data.synopsis
      if (data.status !== undefined) body.status = data.status
      if (data.episodeNo !== undefined) body.episode_no = data.episodeNo
      const response = await fetch(`${API_BASE}/script-episodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        throw new Error('更新剧集失败')
      }
      const episodePayload = await response.json()
      const updatedEpisode = episodePayload?.data
      if (!updatedEpisode) throw new Error('更新剧集失败')
      const mapped: ScriptEpisode = {
        ...updatedEpisode,
        episodeNo: updatedEpisode.episode_no,
        documentId: updatedEpisode.document_id,
      }
      set({
        episodes: get().episodes.map((ep) =>
          ep.id === id ? mapped : ep
        ),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 删除剧集
  deleteEpisode: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-episodes/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除剧集失败')
      }
      set({
        episodes: get().episodes.filter((ep) => ep.id !== id),
        scenes: get().scenes.filter((s) => s.episodeId !== id),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 创建场景
  createScene: async (episodeId: string, data: Partial<ScriptScene>) => {
    const { currentDocument } = get()
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentDocument?.project_id || '',
          episode_id: episodeId,
          location_name: data.location ?? '',
          time_of_day: data.time ?? 'day',
          description: data.description ?? '',
          notes: data.notes ?? '',
        }),
      })
      if (!response.ok) {
        throw new Error('创建场景失败')
      }
      const scenePayload = await response.json()
      const scene = scenePayload?.data
      if (!scene) throw new Error('创建场景失败')
      const mapped: ScriptScene = {
        ...scene,
        episodeId: scene.episode_id,
        location: scene.location_name,
        time: scene.time_of_day,
      }
      set({
        scenes: [...get().scenes, mapped],
        episodes: get().episodes.map((ep) =>
          ep.id === episodeId
            ? { ...ep, scenes: [...(ep.scenes || []), mapped] }
            : ep
        ),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 更新场景
  updateScene: async (id: string, data: Partial<ScriptScene>) => {
    set({ isLoading: true, error: null })
    try {
      const body: Record<string, any> = {}
      if (data.location !== undefined) body.location_name = data.location
      if (data.time !== undefined) body.time_of_day = data.time
      if (data.description !== undefined) body.description = data.description
      if (data.notes !== undefined) body.notes = data.notes
      const response = await fetch(`${API_BASE}/script-scenes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        throw new Error('更新场景失败')
      }
      const scenePayload = await response.json()
      const updatedScene = scenePayload?.data
      if (!updatedScene) throw new Error('更新场景失败')
      const mapped: ScriptScene = {
        ...updatedScene,
        episodeId: updatedScene.episode_id,
        location: updatedScene.location_name,
        time: updatedScene.time_of_day,
      }
      set({
        scenes: get().scenes.map((s) => s.id === id ? mapped : s),
        episodes: get().episodes.map((ep) => ({
          ...ep,
          scenes: (ep.scenes || []).map((s) => s.id === id ? mapped : s),
        })),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 删除场景
  deleteScene: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-scenes/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除场景失败')
      }
      set({
        scenes: get().scenes.filter((s) => s.id !== id),
        episodes: get().episodes.map((ep) => ({
          ...ep,
          scenes: (ep.scenes || []).filter((s) => s.id !== id),
        })),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 选择剧集
  selectEpisode: (id: string | null) => {
    set({ selectedEpisode: id, selectedScene: null })
  },

  // 选择场景
  selectScene: (id: string | null) => {
    set({ selectedScene: id })
  },

  // 添加角色
  addCharacter: (character: ScriptCharacter) => {
    set({ characters: [...get().characters, character] })
  },

  // 移除角色
  removeCharacter: (id: string) => {
    set({ characters: get().characters.filter((c) => c.id !== id) })
  },

  // 加载版本历史
  loadVersions: async () => {
    const { currentDocument } = get()
    if (!currentDocument) return

    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-documents/${currentDocument.id}/versions`)
      if (!response.ok) {
        throw new Error('加载版本历史失败')
      }
      const versionsPayload = await response.json()
      const versions = versionsPayload?.data ?? []
      set({ versions, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 恢复版本
  restoreVersion: async (versionId: string) => {
    const { currentDocument, versions } = get()
    if (!currentDocument) return

    const version = versions.find((v) => v.id === versionId)
    if (!version) return

    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-documents/${currentDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editor_json: typeof version.content === 'string' ? version.content : JSON.stringify(version.content),
        }),
      })
      if (!response.ok) {
        throw new Error('恢复版本失败')
      }
      const restorePayload = await response.json()
      const restoredDoc = restorePayload?.data
      set({
        currentDocument: restoredDoc ? { ...currentDocument, ...restoredDoc } : currentDocument,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 删除版本
  deleteVersion: async (versionId: string) => {
    const { versions } = get()

    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-versions/${versionId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('删除版本失败')
      }
      set({
        versions: versions.filter((v) => v.id !== versionId),
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
    }
  },

  // 设置错误
  setError: (error: string | null) => {
    set({ error })
  },

  // 重置状态
  reset: () => {
    set({
      currentDocument: null,
      episodes: [],
      scenes: [],
      characters: [],
      versions: [],
      selectedEpisode: null,
      selectedScene: null,
      isSaving: false,
      lastSavedAt: null,
      isLoading: false,
      error: null,
    })
  },
}))

// 导出类型
export type {
  ScriptDocument,
  ScriptEpisode,
  ScriptScene,
  ScriptCharacter,
  ScriptVersion,
  ScriptState,
}