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
  /** 工厂同步后的资产 ID */
  assetId?: string
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
  image?: string
  role?: string
  gender?: string
}

interface ScriptProp {
  id: string
  name: string
  assetId?: string
  description?: string
  category?: string
  color?: string
  thumbnail?: string
  image?: string
}

/** 场景工厂资产（与 ScriptScene 区分：这是可复用的工厂场景，不是剧本内的场景） */
interface ScriptSceneAsset {
  id: string
  name: string
  assetId?: string
  description?: string
  location?: string
  time?: string
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
  /** 角色工厂资产（按项目加载） */
  characters: ScriptCharacter[]
  /** 道具工厂资产（按项目加载） */
  props: ScriptProp[]
  /** 场景工厂资产（按项目加载） */
  sceneAssets: ScriptSceneAsset[]
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
  createEpisode: (data: Partial<ScriptEpisode>) => Promise<ScriptEpisode | null>
  updateEpisode: (id: string, data: Partial<ScriptEpisode>) => Promise<void>
  deleteEpisode: (id: string) => Promise<void>
  createScene: (episodeId: string, data: Partial<ScriptScene>) => Promise<ScriptScene | null>
  updateScene: (id: string, data: Partial<ScriptScene>) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  selectEpisode: (id: string | null) => void
  selectScene: (id: string | null) => void
  addCharacter: (character: ScriptCharacter) => void
  updateCharacter: (id: string, data: Partial<ScriptCharacter>) => void
  removeCharacter: (id: string) => void
  addProp: (prop: ScriptProp) => void
  updateProp: (id: string, data: Partial<ScriptProp>) => void
  removeProp: (id: string) => void
  /** 用工厂返回的资产批量覆盖/追加当前 store 中的角色/场景/道具 */
  setFactoryAssets: (assets: {
    characters?: ScriptCharacter[]
    props?: ScriptProp[]
    sceneAssets?: ScriptSceneAsset[]
  }) => void
  /** 追加单个工厂资产（分析结果落库后回填） */
  appendFactoryAsset: (kind: 'character' | 'prop' | 'scene', asset: any) => void
  /** 从 store 中移除一条工厂资产（按 id） */
  removeFactoryAsset: (kind: 'character' | 'prop' | 'scene', id: string) => void
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
  props: [],
  sceneAssets: [],
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
    // 进度回调（页面上展示"正在加载中，请耐心等待"）
    const setProgress = (stage: string) => {
      if (typeof window !== 'undefined') {
        // 让 UI 能在加载阶段显示当前进度
        ;(window as any).__scriptLoadProgress = stage
      }
    }
    setProgress('正在加载剧本…')
    try {
      // 后端统一响应格式为 { code, message, data }，需要解包
      // 1. 先获取所有模块 Script 列表，用于查找元数据（title 等）
      setProgress('正在查询剧本元数据…')
      const scriptResponse = await fetch(`${API_BASE}/scripts`)
      const scriptPayload = scriptResponse.ok ? await scriptResponse.json() : null
      const scripts: any[] = scriptPayload?.data ?? []
      const moduleScript = scripts.find((s: any) => s.id === docId) || null

      // 2. 优先按 docId 直接尝试加载 ScriptDocument（兼容旧数据：文档 ID = 剧本 ID）
      let doc: any = null
      const directDocResponse = await fetch(`${API_BASE}/script-documents/${docId}`)
      if (directDocResponse.ok) {
        const directPayload = await directDocResponse.json()
        doc = directPayload?.data ?? null
      }

      // 3. 若直接查找失败且已知项目，按项目列出所有 ScriptDocument，
      //    选取与本剧本标题最匹配（或最新一条）的文档。
      //    导入流程会在 POST scripts 后再 POST script-documents，两次返回的 id 不同，
      //    所以需要按"项目内最新文档"回退匹配。
      if (!doc && moduleScript?.project_id) {
        try {
          const listResp = await fetch(`${API_BASE}/script-documents?projectId=${encodeURIComponent(moduleScript.project_id)}`)
          if (listResp.ok) {
            const listPayload = await listResp.json()
            const documents: any[] = listPayload?.data ?? []
            // 优先按"标题一致"匹配；否则取最新一条
            const matched = documents.find((d) => d.title && moduleScript.title && d.title === moduleScript.title)
            doc = matched || (documents.length > 0 ? documents[0] : null)
          }
        } catch {
          // 列表查询失败时忽略，继续走"按需创建"逻辑
        }
      }

      // 4. ScriptDocument 仍不存在但有模块 Script → 创建对应的 ScriptDocument
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
        const documentId = doc.id as string
        // 加载该剧本对应的剧集列表（优先按 documentId 过滤，避免拉到项目下的其他剧本剧集）
        let loadedEpisodes: ScriptEpisode[] = []
        try {
          const epResponse = await fetch(`${API_BASE}/script-episodes?documentId=${encodeURIComponent(documentId)}`)
          if (epResponse.ok) {
            const epPayload = await epResponse.json()
            const rawEpisodes: any[] = epPayload?.data ?? []
            loadedEpisodes = rawEpisodes.map((ep) => ({
              ...ep,
              episodeNo: ep.episode_no,
              documentId: ep.document_id,
              scenes: [],
            }))
          } else {
            // 后端缺少 documentId 过滤时回退到 projectId
            const fallback = await fetch(`${API_BASE}/script-episodes?projectId=${encodeURIComponent(projectId)}`)
            if (fallback.ok) {
              const fbPayload = await fallback.json()
              const rawEpisodes: any[] = fbPayload?.data ?? []
              loadedEpisodes = rawEpisodes
                .filter((ep) => !ep.document_id || ep.document_id === documentId)
                .map((ep) => ({
                  ...ep,
                  episodeNo: ep.episode_no,
                  documentId: ep.document_id,
                  scenes: [],
                }))
            }
          }
        } catch {
          // 剧集加载失败不阻塞编辑器
        }
        // 加载所有场景并按 episode_id 分组挂到剧集上
        let loadedScenes: ScriptScene[] = []
        try {
          const scResponse = await fetch(`${API_BASE}/script-scenes?projectId=${encodeURIComponent(projectId)}`)
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

        // 加载工厂的角色 / 道具 / 场景（按项目过滤），
        // 这样右侧"角色/道具/场景"面板就能看到导入时已自动建好的资产。
        let loadedCharacters: ScriptCharacter[] = []
        let loadedProps: ScriptProp[] = []
        let loadedSceneAssets: ScriptSceneAsset[] = []
        if (projectId) {
          try {
            const charRes = await fetch(`${API_BASE}/characters?projectId=${encodeURIComponent(projectId)}`)
            if (charRes.ok) {
              const charPayload = await charRes.json()
              const rawChars: any[] = charPayload?.data ?? []
              loadedCharacters = rawChars.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description ?? '',
                color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
                assetId: c.id,
                image: c.image,
                role: c.role,
                gender: c.gender,
              }))
            }
          } catch {
            // 角色加载失败不阻塞编辑器
          }
          try {
            const propRes = await fetch(`${API_BASE}/props?projectId=${encodeURIComponent(projectId)}`)
            if (propRes.ok) {
              const propPayload = await propRes.json()
              const rawProps: any[] = propPayload?.data ?? []
              loadedProps = rawProps.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description ?? '',
                category: p.category,
                assetId: p.id,
                image: p.image,
              }))
            }
          } catch {
            // 道具加载失败不阻塞编辑器
          }
          try {
            const sceneRes = await fetch(`${API_BASE}/scenes?projectId=${encodeURIComponent(projectId)}`)
            if (sceneRes.ok) {
              const scenePayload = await sceneRes.json()
              const rawScenes: any[] = scenePayload?.data ?? []
              loadedSceneAssets = rawScenes.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description ?? '',
                // 兼容后端字段：场景工厂用 name 存地点，时间段在 time_of_day
                location: s.name,
                time: s.time_of_day,
                assetId: s.id,
                thumbnail: s.image,
              }))
            }
          } catch {
            // 场景工厂加载失败不阻塞编辑器
          }
        }

        set({
          currentDocument: {
            ...moduleScript,
            ...doc,
            id: documentId,
            editor_json: editorJson,
          },
          episodes: loadedEpisodes,
          scenes: loadedScenes,
          characters: loadedCharacters,
          props: loadedProps,
          sceneAssets: loadedSceneAssets,
          isLoading: false,
        })
        return
      }

      throw new Error(
        moduleScript
          ? `剧本文档创建失败（ID=${docId}，项目=${moduleScript.project_id || '未知'}）。可能是 SQLite 写入权限或数据库被占用`
          : `剧本不存在或已删除（ID=${docId}）。请检查：1)剧本是否被删除；2)后端服务是否运行；3)URL 中的剧本 ID 是否正确`,
      )
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
    if (!currentDocument) return null

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
      return mapped
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
      return null
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
      return mapped
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false,
      })
      return null
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

  // 更新角色（剧本中心侧）
  updateCharacter: (id: string, data: Partial<ScriptCharacter>) => {
    set({
      characters: get().characters.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })
  },

  // 移除角色
  removeCharacter: (id: string) => {
    set({ characters: get().characters.filter((c) => c.id !== id) })
  },

  // 添加道具
  addProp: (prop: ScriptProp) => {
    set({ props: [...get().props, prop] })
  },

  // 更新道具（剧本中心侧）
  updateProp: (id: string, data: Partial<ScriptProp>) => {
    set({
      props: get().props.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })
  },

  // 移除道具
  removeProp: (id: string) => {
    set({ props: get().props.filter((p) => p.id !== id) })
  },

  /** 用工厂返回的资产批量覆盖 store 中角色/道具/场景（按资产去重） */
  setFactoryAssets: (assets) => {
    const patch: Partial<Pick<ScriptState, 'characters' | 'props' | 'sceneAssets'>> = {}
    if (assets.characters) patch.characters = assets.characters
    if (assets.props) patch.props = assets.props
    if (assets.sceneAssets) patch.sceneAssets = assets.sceneAssets
    set(patch as any)
  },

  /** 把一条新建的工厂资产追加到 store（去重） */
  appendFactoryAsset: (kind, asset) => {
    if (!asset || !asset.id) return
    if (kind === 'character') {
      const list = get().characters
      if (list.some((c) => c.id === asset.id)) return
      set({
        characters: [
          ...list,
          {
            id: asset.id,
            name: asset.name,
            description: asset.description ?? '',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            assetId: asset.id,
            image: asset.image,
            role: asset.role,
            gender: asset.gender,
          },
        ],
      })
    } else if (kind === 'prop') {
      const list = get().props
      if (list.some((p) => p.id === asset.id)) return
      set({
        props: [
          ...list,
          {
            id: asset.id,
            name: asset.name,
            description: asset.description ?? '',
            category: asset.category,
            assetId: asset.id,
            image: asset.image,
          },
        ],
      })
    } else if (kind === 'scene') {
      const list = get().sceneAssets
      if (list.some((s) => s.id === asset.id)) return
      set({
        sceneAssets: [
          ...list,
          {
            id: asset.id,
            name: asset.name,
            description: asset.description ?? '',
            location: asset.name,
            time: asset.time_of_day,
            assetId: asset.id,
            thumbnail: asset.image,
          },
        ],
      })
    }
  },

  /** 从 store 中移除一条工厂资产（按 id） */
  removeFactoryAsset: (kind, id) => {
    if (kind === 'character') {
      set({ characters: get().characters.filter((c) => c.id !== id) })
    } else if (kind === 'prop') {
      set({ props: get().props.filter((p) => p.id !== id) })
    } else if (kind === 'scene') {
      set({ sceneAssets: get().sceneAssets.filter((s) => s.id !== id) })
    }
  },

  // 加载版本历史
  loadVersions: async () => {
    const { currentDocument } = get()
    if (!currentDocument) return

    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/script-versions?documentId=${encodeURIComponent(currentDocument.id)}`)
      if (!response.ok) {
        throw new Error('加载版本历史失败')
      }
      const versionsPayload = await response.json()
      const rawVersions: any[] = versionsPayload?.data ?? []
      // 后端返回的是 ScriptBackup 结构，映射为前端 ScriptVersion
      const versions: ScriptVersion[] = rawVersions.map((v) => {
        const typeLabel = v.type === 'auto' ? '自动保存' : v.type === 'scheduled' ? '定时备份' : '手动保存'
        return {
          id: v.id,
          version: v.content?.version ?? 1,
          timestamp: v.created_at,
          changes: typeLabel,
          author: v.created_by,
          // 前端预览/恢复时直接用 script_document 字符串
          content: v.content?.script_document ?? '',
        }
      })
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
      props: [],
      sceneAssets: [],
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
  ScriptProp,
  ScriptSceneAsset,
  ScriptVersion,
  ScriptState,
}