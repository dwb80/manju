'use client'

/**
 * 剧本编辑页（/scripts/[id]）
 *
 * 设计原则：
 * - 单一职责：仅作为"剧本编辑工作台"的容器，协调各子模块（编辑器/侧栏/右面板/弹窗）
 * - 低耦合：业务逻辑下沉到 hooks（useScriptSave、useScriptAnalyze 等），UI 下沉到组件
 * - 状态分离：UI 状态（弹窗、视图模式）保留在 page，业务数据由 script-store 统一管理
 *
 * 历史变更：
 * - v2（评审优化）：移除右侧"场景" Tab，场景资产统一由左侧 ScriptSidebar 维护
 * - v2（评审优化）：将原 ~1190 行单体文件拆分为：
 *     - ScriptEditRightPanel / ScriptEditRightPanel 右侧面板
 *     - VersionHistoryModal / VersionPreviewModal / AnalyzePreviewModal 弹窗
 *     - useScriptSave 保存 hook
 *     - lib/logger 模块化日志
 *     - constants Tab 与工厂入口配置
 */

import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ScriptEditor, ScriptToolbar, ScriptSidebar, OutlineView } from '@/components/dashboard/script-center'
import type { SidebarJumpTarget } from '@/components/dashboard/script-center/ScriptSidebar'
import type { NavTreeNode } from '@/components/dashboard/script-center'
import { ScriptEditRightPanel } from '@/components/dashboard/script-center/ScriptEditRightPanel'
import { VersionHistoryModal } from '@/components/dashboard/script-center/modals/VersionHistoryModal'
import { VersionPreviewModal } from '@/components/dashboard/script-center/modals/VersionPreviewModal'
import { AnalyzePreviewModal } from '@/components/dashboard/script-center/modals/AnalyzePreviewModal'
import { useScriptSave } from '@/components/dashboard/script-center/hooks/useScriptSave'
import { useScriptStore } from '@/lib/stores/script-store'
import type { ScriptVersion } from '@/lib/stores/script-store'
import { scriptCenterService } from '@/services/script-center.service'
import {
  listCharacterImages,
  listSceneImages,
  listPropImages,
  pickPrimaryImage,
} from '@/services/asset-image.service'
import {
  createCharacter as createCharacterFactory,
  createScene as createSceneFactory,
  createProp as createPropFactory,
} from '@/services/module.service'
import { getFactoryBus } from '@/lib/factory-bus'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { toast } from '@/components/common/toast'
import { notify } from '@/lib/notify'
import { createLogger } from '@/lib/logger'
import { useScriptAnalyze } from '@/components/dashboard/script-center/hooks/useScriptAnalyze'
import type { CharacterDetailMerged } from '@/components/dashboard/script-center/modals/CharacterDetailModal'
import type { SceneDetailMerged } from '@/components/dashboard/script-center/modals/SceneDetailModal'
import type { PropDetailMerged } from '@/components/dashboard/script-center/modals/PropDetailModal'

// 页面级 logger
const log = createLogger('script-edit-page')

// 懒加载导入导出对话框（用户触发时才下载）
const ImportExportDialog = lazy(() =>
  import('@/components/dashboard/script-center/ImportExportDialog').then((m) => ({
    default: m.ImportExportDialog,
  })),
)

// 加载占位符
function LoadingFallback() {
  return <div className="p-4 text-center text-gray-400">加载中...</div>
}

// === 大纲视图数据类型（与 OutlineView 组件接口一致） ===
interface OutlineNode {
  id: string
  type: 'episode' | 'scene' | 'character'
  title: string
  subtitle?: string
  children?: OutlineNode[]
  order: number
}

/**
 * 将 editor 导航树转换为大纲视图所需结构
 */
function convertNavTreeToOutline(nodes: NavTreeNode[]): OutlineNode[] {
  return nodes.map((node, index) => {
    const outlineType: 'episode' | 'scene' | 'character' =
      node.type === 'episode' ? 'episode' : 'scene'
    let subtitle: string | undefined
    if (node.type === 'episode' && node.episodeNo) {
      subtitle = `第${node.episodeNo}集`
    } else if (node.type === 'scene' && node.location) {
      subtitle = `${node.location}${node.time ? ' · ' + node.time : ''}`
    }
    return {
      id: node.id,
      type: outlineType,
      title: node.title,
      subtitle,
      children: node.children?.length ? convertNavTreeToOutline(node.children) : undefined,
      order: index,
    }
  })
}

// ============================================================
// 剧本中心 analyzed-assets → 右侧面板数据形状的转换器
// ============================================================
//
// 背景：右侧面板（ScriptEditRightPanel → CharacterPanel/ScenePanel/PropPanel）的
// 字段形状是基于"工厂表（characters/scenes/props）"的，工厂实体有 `usage_count`、
// `version`、`tags`、`color` 等业务字段。剧本中心（analyzed-assets）没有这些字段，
// 也没有缩略图，所以这里做一个最小可用映射，缺字段全部兜空，**避免面板崩溃**。
//
// 重要：以下颜色取自 importance_level（protagonist/...）和 gender（male/female），
// 仅用作占位色块，不是真实视觉。

const IMPORTANCE_COLOR: Record<string, string> = {
  protagonist: '#ef4444', // red
  antagonist: '#a855f7',  // purple
  supporting: '#3b82f6',  // blue
  minor: '#9ca3af',       // gray
}

const CHARACTER_NAME_BLOCKLIST: ReadonlySet<string> = new Set([
  "场景", "角色", "道具", "简介", "正文", "旁白", "OS", "VO",
  "剧本大纲", "AI生成剧本大纲", "故事梗概", "主要角色介绍",
  "创意描述", "基本信息", "角色设定", "剧情结构", "故事结构",
  "开场状态", "矛盾建立", "冲突升级", "高潮节点", "结尾状态",
  "类型", "风格", "时代背景", "背景", "核心冲突", "目标字数",
  "故事主题", "视觉主题", "对白风格", "时长预估", "集数信息",
  "剧集名称", "题材类型", "主线事件", "分集大纲", "声音",
  "场景一", "场景二", "场景三", "场景四", "场景五", "场景六", "场景七", "场景八",
  "景一", "景二", "景三", "景四", "景五", "景六", "景七", "景八",
  "第一场", "第二场", "第三场", "第四场", "第五场",
  "第一章", "第二章", "第三章", "第四章", "第五章",
  "第一幕", "第二幕", "第三幕", "第四幕", "第五幕",
])

/**
 * 兜底：前端读取 analyzed-characters 时，过滤掉明显不是角色名的脏数据。
 * 后端 normalizeCharacter 已经在写入前做了校验，但旧版数据/缓存仍可能含
 * "## 场景二" / "**类型**" / "清晨6" 等被误识别为角色的字段。
 */
function filterAnalyzedCharacters(list: any[]): any[] {
  return (list || []).filter((c) => {
    const name = String(c?.name || "").trim()
    if (!name) return false
    if (name.length < 2 || name.length > 20) return false
    if (/[#*~`_\[\]【】()（）]/.test(name)) return false
    if (!/[\u4e00-\u9fff]/.test(name)) return false
    if (CHARACTER_NAME_BLOCKLIST.has(name)) return false
    if (/\d$/.test(name)) return false
    if (/^[·\-、，,。:：!?]/.test(name)) return false
    return true
  })
}

function analyzedCharToRightPanelShape(c: any, imageMap?: Map<string, string>) {
  // 主图优先级：imageMap（工厂 character_images 主图） > 自身 image
  const factoryId = c.factory_character_id
  const primaryImage = (factoryId && imageMap?.get(factoryId)) || c.image || ''
  return {
    id: c.id,
    assetId: c.factory_character_id, // 关联到工厂时才有；无则 undefined
    name: c.name || '未命名角色',
    description: c.description || '',
    role: c.role || c.importance_level || '',
    gender: c.gender || '',
    age: typeof c.age === 'string' ? parseInt(c.age, 10) || 0 : c.age,
    appearance: c.appearance || '',
    personality: c.personality || '',
    traits: Array.isArray(c.traits) ? c.traits : [],
    tags: Array.isArray(c.tags) ? c.tags : [],
    color: IMPORTANCE_COLOR[c.role || c.importance_level] || IMPORTANCE_COLOR.minor,
    thumbnail: primaryImage,
    image: primaryImage,
    identity: c.identity,
    dialogue_count: c.dialogue_count,
    usage_count: 0, // 剧本中心不统计使用次数
    version: 1,
    // 保留源数据，方便调试 + 后续"详情弹框"展示
    _source: 'script-center',
  }
}

function analyzedSceneToRightPanelShape(s: any, imageMap?: Map<string, string>) {
  const factoryId = s.factory_scene_id
  const primaryImage = (factoryId && imageMap?.get(factoryId)) || s.image || ''
  // 优先用 factory-aligned 字段名 type，回退到旧字段 scene_type（兼容历史数据）
  const sceneType = s.type ?? s.scene_type ?? 'outdoor'
  return {
    id: s.id,
    assetId: s.factory_scene_id,
    name: s.name || s.location || '未命名场景',
    description: s.description || '',
    location: s.location || s.name || '',
    time: s.time_of_day || '',
    thumbnail: primaryImage,
    image: primaryImage,
    type: sceneType,
    scene_type: sceneType, // 兼容旧字段读取
    category: s.category || '',
    indoor_outdoor: s.indoor_outdoor || '',
    lighting: s.lighting || '',
    time_of_day: s.time_of_day || '',
    weather: s.weather || '',
    architecture: s.architecture || '',
    terrain: s.terrain || '',
    plants: s.plants || '',
    objects: s.objects || '',
    period: s.period || '',
    tone: s.tone || '',
    visual_style: s.visual_style || '',
    atmosphere_emotion: s.atmosphere_emotion || '',
    suitable_shots: s.suitable_shots,
    reusable_elements: s.reusable_elements,
    tags: Array.isArray(s.tags) ? s.tags : [],
    usage_count: 0,
    version: 1,
    _source: 'script-center',
  }
}

function analyzedPropToRightPanelShape(p: any, imageMap?: Map<string, string>) {
  const factoryId = p.factory_prop_id
  const primaryImage = (factoryId && imageMap?.get(factoryId)) || p.image || ''
  return {
    id: p.id,
    assetId: p.factory_prop_id,
    name: p.name || '未命名道具',
    description: p.description || '',
    category: p.category || '',
    color: p.color || '',
    material: p.material || '',
    size: p.size || '',
    appearance: p.appearance || '',
    importance_level: p.importance_level || '',
    owner: p.owner || '',
    shape: p.shape || '',
    texture: p.texture || '',
    visual_features: p.visual_features || '',
    camera_usage: p.camera_usage || '',
    story_function: p.story_function || '',
    first_appearance: p.first_appearance || '',
    thumbnail: primaryImage,
    image: primaryImage,
    tags: Array.isArray(p.tags) ? p.tags : [],
    usage_count: 0,
    version: 1,
    _source: 'script-center',
  }
}

// ============================================================
// 主组件
// ============================================================
export default function ScriptEditPage() {
  const params = useParams()
  const scriptId = params.id as string

  // ---- store 数据 ----
  const {
    currentDocument,
    episodes,
    scenes,
    characters,
    props: propAssets,
    sceneAssets,
    versions,
    selectedEpisode,
    selectedScene,
    isLoading,
    error,
    loadDocument,
    createEpisode,
    updateEpisode,
    deleteEpisode,
    createScene,
    updateScene,
    deleteScene,
    selectEpisode,
    selectScene,
    addCharacter,
    updateCharacter: updateScriptCharacter,
    removeCharacter,
    addProp,
    updateProp: updateScriptProp,
    removeProp,
    appendFactoryAsset,
    removeFactoryAsset,
    loadVersions,
    restoreVersion,
    deleteVersion,
  } = useScriptStore()

  // ---- UI 状态 ----
  const [editor, setEditor] = useState<any>(null)
  const [editorTree, setEditorTree] = useState<NavTreeNode[]>([])
  const [viewMode, setViewMode] = useState<'edit' | 'outline'>('edit')
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([])
  /** 右侧面板当前 Tab（受控），顶部"评论"按钮可切到 'comment' */
  const [rightPanelTab, setRightPanelTab] = useState<import('@/components/dashboard/script-center').RightPanelTab>('character')

  // 弹窗状态
  const [showImportExport, setShowImportExport] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null)
  const [showAnalyzeConfirm, setShowAnalyzeConfirm] = useState(false)
  const [analyzePreview, setAnalyzePreview] = useState<any>(null)
  // 方案 A：元数据 inline-edit 脏值标记（与 editor 脏值同源以保持一致）
  const [isDirty, setIsDirty] = useState(false)

  // AI 分析前的原文快照：用于分析后重建 Tiptap 结构（让剧集/场景与正文锚定）
  const [pendingAnalyzeText, setPendingAnalyzeText] = useState<string>('')
  const [pendingAnalyzeJson, setPendingAnalyzeJson] = useState<any>(null)

  // ---- 剧本中心 analyzed-assets（右侧面板的数据源） ----
  // 不从工厂加载：剧本中心 = 剧本编辑器右侧面板的"唯一数据源"
  // - import 时：useScriptImport.handleConfirmImport 会写一份到 analyzed-assets
  // - editor 中 AI analyze apply 时：useScriptAnalyze.apply 也会写一份
  // - 工厂那条路只在用户主动"流转到工厂"时由右面板触发 PATCH（updateAnalyzedCharacter）
  const [analyzedCharacters, setAnalyzedCharacters] = useState<any[]>([])
  const [analyzedScenes, setAnalyzedScenes] = useState<any[]>([])
  const [analyzedProps, setAnalyzedProps] = useState<any[]>([])
  // 用于在导入/AI apply 写库后主动重拉一次（re-fetch 触发器）
  const [analyzedRefreshTick, setAnalyzedRefreshTick] = useState(0)

  useEffect(() => {
    if (!scriptId) return
    let cancelled = false
    scriptCenterService
      .getAnalyzedAssets(scriptId)
      .then((res) => {
        if (cancelled) return
        // 兜底过滤：旧版数据/旧版缓存里可能仍有明显不是角色名的脏数据（如 "## 场景二"）
        setAnalyzedCharacters(filterAnalyzedCharacters(res.characters || []))
        setAnalyzedScenes(res.scenes || [])
        setAnalyzedProps(res.props || [])
      })
      .catch((err) => {
        // 404 等情况说明这个剧本还没有 analyzed-assets（可能是新建空白剧本），忽略即可
        log.debug('getAnalyzedAssets skipped:', err)
      })
    return () => {
      cancelled = true
    }
  }, [scriptId, analyzedRefreshTick])

  // === 工厂资产图片映射（按 factory id 索引主图 URL） ===
  // - 右面板"来自剧本中心"的卡片需要显示图
  // - 剧本中心表本身没有 image 字段（按需求），所以从这里读
  // - 每次 analyzedRefreshTick 变化（导入/AI apply 写库后）或 analyzedCharacters 变化时刷新
  const [charImageMap, setCharImageMap] = useState<Map<string, string>>(new Map())
  const [sceneImageMap, setSceneImageMap] = useState<Map<string, string>>(new Map())
  const [propImageMap, setPropImageMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    const factoryIds = {
      char: Array.from(
        new Set(analyzedCharacters.map((c: any) => c.factory_character_id).filter(Boolean) as string[]),
      ),
      scene: Array.from(
        new Set(analyzedScenes.map((s: any) => s.factory_scene_id).filter(Boolean) as string[]),
      ),
      prop: Array.from(
        new Set(analyzedProps.map((p: any) => p.factory_prop_id).filter(Boolean) as string[]),
      ),
    }
    Promise.all([
      Promise.all(factoryIds.char.map((id) => listCharacterImages(id).catch(() => []))),
      Promise.all(factoryIds.scene.map((id) => listSceneImages(id).catch(() => []))),
      Promise.all(factoryIds.prop.map((id) => listPropImages(id).catch(() => []))),
    ]).then(([charLists, sceneLists, propLists]) => {
      if (cancelled) return
      const cMap = new Map<string, string>()
      factoryIds.char.forEach((id, idx) => {
        const primary = pickPrimaryImage(charLists[idx])
        if (primary?.url) cMap.set(id, primary.url)
      })
      const sMap = new Map<string, string>()
      factoryIds.scene.forEach((id, idx) => {
        const primary = pickPrimaryImage(sceneLists[idx])
        if (primary?.url) sMap.set(id, primary.url)
      })
      const pMap = new Map<string, string>()
      factoryIds.prop.forEach((id, idx) => {
        const primary = pickPrimaryImage(propLists[idx])
        if (primary?.url) pMap.set(id, primary.url)
      })
      setCharImageMap(cMap)
      setSceneImageMap(sMap)
      setPropImageMap(pMap)
    })
    return () => {
      cancelled = true
    }
  }, [analyzedCharacters, analyzedScenes, analyzedProps, analyzedRefreshTick])

  // === 监听 factoryBus 事件（角色/场景/道具图片在工厂新标签页被改后，跨标签页自动刷新） ===
  // - 任意 character:*/scene:*/prop:* 事件触发时：递增 analyzedRefreshTick
  //   → 上面的 useEffect 会重拉 imageMaps，右面板头像会同步更新
  useEffect(() => {
    const bus = getFactoryBus()
    const events = [
      'character:image-added',
      'character:image-deleted',
      'character:image-primary-changed',
      'character:updated',
      'character:deleted',
      'scene:image-added',
      'scene:image-deleted',
      'scene:image-primary-changed',
      'scene:updated',
      'scene:deleted',
      'prop:image-added',
      'prop:image-deleted',
      'prop:image-primary-changed',
      'prop:updated',
      'prop:deleted',
      'factory:asset-list-changed',
    ] as const
    const unsubs = events.map((e) => bus.on(e as any, () => setAnalyzedRefreshTick((t) => t + 1)))
    return () => unsubs.forEach((u) => u())
  }, [])

  // 评论选区
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ from: number; to: number } | undefined>(undefined)

  // ---- 副作用 ----
  // 修复字段错位/重复加载：使用 ref 记录已加载的 scriptId，
  // 避免 React StrictMode 双调用 + 父组件重渲染导致的 loadDocument 重复触发。
  // 重复触发会让 store 的 isLoading 反复重置为 true，set 完后页面又因别处状态变化被冲掉。
  const loadedScriptIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!scriptId) return
    if (loadedScriptIdRef.current === scriptId) {
      log.debug('skip duplicate loadDocument for same scriptId', { scriptId })
      return
    }
    loadedScriptIdRef.current = scriptId
    log.info('load document', { scriptId })
    // 重置 store，避免上一次会话的缓存影响本次加载
    useScriptStore.getState().reset()
    loadDocument(scriptId)
  }, [scriptId, loadDocument])

  useEffect(() => {
    if (currentDocument && showVersionHistory) {
      log.debug('load versions on history open')
      loadVersions()
    }
  }, [currentDocument, showVersionHistory, loadVersions])

  useEffect(() => {
    if (viewMode === 'outline') {
      setOutlineNodes(convertNavTreeToOutline(editorTree))
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 跟踪编辑器选中文本（用于评论功能）
  useEffect(() => {
    if (!editor) return
    const updateSelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        setSelectedText(editor.state.doc.textBetween(from, to, ' '))
        setSelectionPosition({ from, to })
      } else {
        setSelectedText('')
        setSelectionPosition(undefined)
      }
    }
    editor.on('selectionUpdate', updateSelection)
    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor])

  // ---- 保存（委托给 useScriptSave hook） ----
  const { save: handleSave, saving: isSaving } = useScriptSave({
    document: currentDocument
      ? {
          id: currentDocument.id,
          project_id: currentDocument.project_id,
          version: currentDocument.version,
          // 方案 A 修复：传入 title/author/status，
          // 让 hook 能把元数据同步写回 script_documents 和 scripts 两张表
          title: currentDocument.title,
          author: currentDocument.author,
          status: currentDocument.status,
        }
      : null,
    editor,
    characters: characters as any,
    sceneAssets: sceneAssets as any,
    propAssets: propAssets as any,
    updateScriptCharacter,
    updateScriptScene: (id, patch) => {
      // 回写剧本侧 + 工厂侧两份数据，让"已同步"状态在右面板和 store 都可见
      setAnalyzedScenes((prev) => prev.map((s) => (s.id === id ? { ...s, assetId: patch.assetId } : s)))
      // store.sceneAssets 的元素也回写（用 appendFactoryAsset 的 patch 语义）
      const fresh = useScriptStore.getState().sceneAssets
      const next = fresh.map((s) => (s.id === id ? { ...s, assetId: patch.assetId } : s))
      useScriptStore.setState({ sceneAssets: next } as any)
    },
    updateScriptProp,
    appendFactoryAsset,
  })

  // ---- AI 分析剧本：第一步打开确认弹窗 ----
  const handleAnalyzeScript = useCallback(() => {
    if (!editor || !currentDocument) return
    const content = editor.getText()
    if (!content.trim()) {
      log.warn('analyze skipped: empty content')
      toast.error('请先输入剧本内容')
      return
    }
    // 在用户确认分析前先抓取"原文快照"，用于分析成功后重建结构化 Tiptap 文档。
    // 重建后侧栏点击剧集才能通过 [data-id] 精确锚定到正文位置。
    setPendingAnalyzeText(content)
    setPendingAnalyzeJson(editor.getJSON())
    log.info('open analyze confirm', { chars: content.length })
    setShowAnalyzeConfirm(true)
  }, [editor, currentDocument])

  // ---- AI 分析剧本：第二步调用大模型 ----
  const handleConfirmAnalyze = useCallback(async () => {
    if (!editor || !currentDocument) return
    setShowAnalyzeConfirm(false)
    const content = editor.getText()
    // 显式可见的"正在分析中"进度提示
    //   - 带"取消"按钮：用户可中止请求（避免 50s 等待）
    //   - 每 1.5s 推一次百分比，模拟真实进度，给用户明确"在分析"的感知
    let progress = 10
    const controller = new AbortController()
    const cancelHandler = () => {
      controller.abort()
      toast.error('已取消 AI 分析')
    }
    const progressId = toast.progress(
      'AI 正在分析剧本…',
      `共 ${content.length} 字，将识别角色 / 场景 / 道具 / 剧集`,
      cancelHandler,
    )
    const progressTimer = setInterval(() => {
      progress = Math.min(progress + 5, 90)
      toast.updateProgress(progressId, progress)
    }, 1500)
    try {
      log.info('analyze request start', { chars: content.length })
      const result = await scriptCenterService.analyzeScript(content, { signal: controller.signal })
      // 检测：若 AI 大模型未返回任何资产，给出明确提示
      const totalAssets =
        (result.characters?.length || 0) +
        (result.scenes?.length || 0) +
        (result.props?.length || 0) +
        (result.episodes?.length || 0)
      setAnalyzePreview({
        characters: result.characters || [],
        scenes: result.scenes || [],
        props: result.props || [],
        episodes: result.episodes || [],
        source: result.source,
        warnings: result.warnings,
      })
      toast.updateProgress(progressId, 100)
      if (totalAssets === 0) {
        // AI 没有识别出任何资产：可能剧本内容为空 / 格式特殊
        toast.success(
          'AI 未识别到角色/场景/道具',
          '可调整剧本格式后重试，或在「角色/场景/道具工厂」中手动添加',
        )
      } else {
        toast.success('AI 分析完成，请确认结果')
      }
      log.info('analyze success', { source: result.source, totalAssets })
    } catch (error) {
      // 用户主动中止时不再弹"分析失败"
      if (error instanceof DOMException && error.name === 'AbortError') {
        log.info('analyze cancelled by user')
      } else {
        log.error('analyze failed', { error: (error as Error).message })
        toast.error('分析失败：' + (error as Error).message)
      }
    } finally {
      clearInterval(progressTimer)
      // 短暂延迟移除，让用户看到 100% 完成态
      setTimeout(() => toast.remove(progressId), 600)
    }
  }, [editor, currentDocument])

  // ---- AI 分析剧本：第三步应用结果（落库到工厂） ----
  //   业务逻辑下沉到 useScriptAnalyze hook（已落库场景/角色/道具到工厂 + 写回 store）
  //   同时会把 AI 返回的剧集/场景结构写回编辑器正文，赋予 [data-id] 锚点。
  const handleContentRestructured = useCallback(
    (newContent: any) => {
      if (!editor || !newContent) return
      // emitUpdate=true：让 ScriptEditor 的 onUpdate 触发 tree 同步 + 自动保存
      editor.commands.setContent(newContent, true)
      log.info('editor content restructured from AI analyze')
    },
    [editor],
  )

  const { apply: applyAnalyze, applying: isApplyingAnalyze } = useScriptAnalyze({
    document: currentDocument ? { id: currentDocument.id, project_id: currentDocument.project_id } : null,
    preview: analyzePreview,
    episodes,
    scenes,
    sceneAssets,
    characters,
    propAssets,
    createEpisode,
    createScene,
    addCharacter,
    addProp,
    appendFactoryAsset,
    originalText: pendingAnalyzeText,
    originalEditorJson: pendingAnalyzeJson,
    onContentRestructured: handleContentRestructured,
  })

  const handleApplyAnalyze = useCallback(async () => {
    const result = await applyAnalyze()
    if (result.success) {
      log.info('analyze applied, closing modal')
      setAnalyzePreview(null)
      // 清空"原文快照"：下次分析时再重新捕获，避免陈旧内容污染后续重建
      setPendingAnalyzeText('')
      setPendingAnalyzeJson(null)
      // 重新拉一次剧本中心 analyzed-assets，让右侧面板立即显示新数据
      // （useScriptAnalyze.apply 已写入 analyzed-assets，这里只是触发 fetch）
      setAnalyzedRefreshTick((t) => t + 1)
    }
  }, [applyAnalyze])

  // ---- 角色详情弹框：父组件注入的回调 ----
  // 1) 查找 analyzePreview 中同 id / 同 name 的 AI 解析数据（用于补全 appearance/personality）
  // 2) 返回保存回调：把"合并后的最新字段"调 PUT /api/characters/:id（upsert），
  //    写库成功后用 updateCharacter 同步刷新 store，让"已同步到工厂"的状态可见。
  const handleViewCharacterDetail = useCallback(
    async (char: any) => {
      const projId = currentDocument?.project_id || ''
      // 在 analyzePreview 中查找同 id / 同 name 的 AI 解析数据
      let aiChar: any = null
      if (analyzePreview?.characters) {
        aiChar =
          analyzePreview.characters.find((c: any) => c?.id === char.id) ||
          analyzePreview.characters.find(
            (c: any) => c?.name && char.name && c.name === char.name,
          ) ||
          null
      }
      return {
        projectId: projId,
        scriptId,
        analyzePreviewCharacter: aiChar,
        onSaveAsAsset: async (merged: CharacterDetailMerged) => {
          // === 编辑流程：直接写剧本中心（不写工厂） ===
          // - char.id 是 script_analyzed_characters 表的主键
          // - 用户在弹框里编辑的字段全部回写到剧本中心对应行
          // - 工厂侧数据不被动；如需同步到工厂，点击「同步到角色工厂」按钮
          if (!char.id) {
            throw new Error('该角色没有剧本中心 ID')
          }
          log.info('PATCH /api/analyzed-characters/:id', { id: char.id, name: merged.name })
          await scriptCenterService.updateAnalyzedCharacter(char.id, {
            name: merged.name,
            description: merged.description,
            role: merged.role,
            gender: merged.gender,
            age: merged.age != null ? String(merged.age) : undefined,
            appearance: merged.appearance,
            personality: merged.personality,
            traits: merged.traits,
            tags: merged.tags,
          })
          // 同步刷新本地 state（让右面板立即看到改动）
          setAnalyzedCharacters((prev) =>
            prev.map((c) =>
              c.id === char.id
                ? {
                    ...c,
                    name: merged.name,
                    description: merged.description,
                    role: merged.role,
                    gender: merged.gender,
                    age: merged.age,
                    appearance: merged.appearance,
                    personality: merged.personality,
                    traits: merged.traits,
                    tags: merged.tags,
                  }
                : c,
            ),
          )
          // 同步刷新 store（用于"打开工厂"链接等）
          updateScriptCharacter(char.id, {
            name: merged.name,
            description: merged.description,
            role: merged.role,
            gender: merged.gender,
            age: merged.age,
            appearance: merged.appearance,
            personality: merged.personality,
            traits: merged.traits,
            tags: merged.tags,
          })
          toast.success(`已保存「${merged.name}」（剧本中心）`)
        },
        // === 同步到角色工厂：写入 characters 表（独立于剧本中心） ===
        onSyncToFactory: async (merged: CharacterDetailMerged) => {
          const name = (merged.name || '').trim()
          if (!name) throw new Error('角色名称为空，无法同步')
          if (!projId) {
            // 无 projectId 仍允许创建（项目 ID 为空），但提示用户
            log.warn('sync character to factory without projectId', { name })
          }
          const payload = {
            name,
            project_id: projId || undefined,
            role: merged.role,
            gender: merged.gender,
            age: merged.age,
            description: merged.description,
            traits: merged.traits,
            tags: merged.tags,
            image: merged.image,
          }
          log.info('POST /api/characters (sync character to factory)', { name, projectId: projId, payload })
          let created: any
          try {
            // 前端 character.service 未暴露 project_id，但后端 createCharacter 接受；这里用 as any 透传
            created = await createCharacterFactory(payload as any)
          } catch (err) {
            const e = err as Error
            // eslint-disable-next-line no-console
            console.error('[page.tsx] sync character POST failed', { name, projId, payload, err })
            throw e
          }
          log.info('POST /api/characters ok', { name, id: created?.id })
          // 同步到 store（让"打开工厂"链接的本地缓存立即可见）
          appendFactoryAsset('character', created)
          // 通知其他打开角色工厂的标签页刷新
          try {
            getFactoryBus().emit('factory:asset-list-changed', {
              kind: 'character',
              projectId: projId || undefined,
            })
          } catch (busErr) {
            log.warn('factoryBus emit failed', { error: (busErr as Error).message })
          }
          toast.success(`已同步到角色工厂：「${created.name}」`)
        },
      }
    },
    [currentDocument?.project_id, scriptId, analyzePreview, updateScriptCharacter, appendFactoryAsset],
  )

  // === 场景详情：编辑后直接写剧本中心 ===
  const handleViewSceneDetail = useCallback(
    async (scene: any) => {
      const projId = currentDocument?.project_id || ''
      let aiScene: any = null
      if (analyzePreview?.scenes) {
        aiScene =
          analyzePreview.scenes.find((s: any) => s?.id === scene.id) ||
          analyzePreview.scenes.find(
            (s: any) => s?.name && scene.name && s.name === scene.name,
          ) ||
          null
      }
      return {
        projectId: projId,
        scriptId,
        analyzePreviewScene: aiScene,
        onSaveAsAsset: async (merged: SceneDetailMerged) => {
          if (!scene.id) {
            throw new Error('该场景没有剧本中心 ID')
          }
          log.info('PATCH /api/analyzed-scenes/:id', { id: scene.id, name: merged.name })
          await scriptCenterService.updateAnalyzedScene(scene.id, {
            name: merged.name,
            description: merged.description,
            type: merged.type,
            category: merged.category,
            location: merged.location,
            lighting: merged.lighting,
            time_of_day: merged.time_of_day,
            weather: merged.weather,
            architecture: merged.architecture,
            terrain: merged.terrain,
            plants: merged.plants,
            objects: merged.objects,
            period: merged.period,
            tone: merged.tone,
            visual_style: merged.visual_style,
            atmosphere_emotion: merged.atmosphere_emotion,
            tags: merged.tags,
          })
          setAnalyzedScenes((prev) =>
            prev.map((s) =>
              s.id === scene.id
                ? {
                    ...s,
                    name: merged.name,
                    description: merged.description,
                    type: merged.type,
                    scene_type: merged.type, // 兼容旧字段
                    category: merged.category,
                    location: merged.location,
                    lighting: merged.lighting,
                    time_of_day: merged.time_of_day,
                    weather: merged.weather,
                    architecture: merged.architecture,
                    terrain: merged.terrain,
                    plants: merged.plants,
                    objects: merged.objects,
                    period: merged.period,
                    tone: merged.tone,
                    visual_style: merged.visual_style,
                    atmosphere_emotion: merged.atmosphere_emotion,
                    tags: merged.tags,
                  }
                : s,
            ),
          )
          toast.success(`已保存「${merged.name}」（剧本中心）`)
        },
        // === 同步到场景工厂：写入 scenes 表（独立于剧本中心） ===
        onSyncToFactory: async (merged: SceneDetailMerged) => {
          const name = (merged.name || '').trim()
          if (!name) throw new Error('场景名称为空，无法同步')
          if (!projId) {
            log.warn('sync scene to factory without projectId', { name })
          }
          const payload = {
            name,
            // scene.service 暂未直接接 projectId / description，先用最小可用字段
            type: merged.type,
            description: merged.description,
            tags: merged.tags,
            lighting: merged.lighting,
            time_of_day: merged.time_of_day,
            weather: merged.weather,
            image: merged.image,
            // === AI 剧本分析扩展字段 ===
            category: merged.category,
            indoor_outdoor: merged.indoor_outdoor,
            location: merged.location,
            architecture: merged.architecture,
            terrain: merged.terrain,
            plants: merged.plants,
            objects: merged.objects,
            period: merged.period,
            tone: merged.tone,
            visual_style: merged.visual_style,
            atmosphere_emotion: merged.atmosphere_emotion,
          }
          log.info('POST /api/scenes (sync scene to factory)', { name, projectId: projId, payload })
          let created: any
          try {
            created = await createSceneFactory(payload as any)
          } catch (err) {
            const e = err as Error
            // eslint-disable-next-line no-console
            console.error('[page.tsx] sync scene POST failed', { name, projId, payload, err })
            throw e
          }
          log.info('POST /api/scenes ok', { name, id: created?.id })
          appendFactoryAsset('scene', { ...created, project_id: projId || undefined })
          try {
            getFactoryBus().emit('factory:asset-list-changed', {
              kind: 'scene',
              projectId: projId || undefined,
            })
          } catch (busErr) {
            log.warn('factoryBus emit failed', { error: (busErr as Error).message })
          }
          toast.success(`已同步到场景工厂：「${created.name}」`)
        },
      }
    },
    [currentDocument?.project_id, scriptId, analyzePreview, appendFactoryAsset],
  )

  // === 道具详情：编辑后直接写剧本中心 ===
  const handleViewPropDetail = useCallback(
    async (prop: any) => {
      const projId = currentDocument?.project_id || ''
      let aiProp: any = null
      if (analyzePreview?.props) {
        aiProp =
          analyzePreview.props.find((p: any) => p?.id === prop.id) ||
          analyzePreview.props.find(
            (p: any) => p?.name && prop.name && p.name === prop.name,
          ) ||
          null
      }
      return {
        projectId: projId,
        scriptId,
        analyzePreviewProp: aiProp,
        onSaveAsAsset: async (merged: PropDetailMerged) => {
          if (!prop.id) {
            throw new Error('该道具没有剧本中心 ID')
          }
          log.info('PATCH /api/analyzed-props/:id', { id: prop.id, name: merged.name })
          await scriptCenterService.updateAnalyzedProp(prop.id, {
            name: merged.name,
            description: merged.description,
            category: merged.category,
            importance_level: merged.importance_level,
            owner: merged.owner,
            appearance: merged.appearance,
            material: merged.material,
            size: merged.size,
            color: merged.color,
            shape: merged.shape,
            texture: merged.texture,
            visual_features: merged.visual_features,
            camera_usage: merged.camera_usage,
            story_function: merged.story_function,
            tags: merged.tags,
          })
          setAnalyzedProps((prev) =>
            prev.map((p) =>
              p.id === prop.id
                ? {
                    ...p,
                    name: merged.name,
                    description: merged.description,
                    category: merged.category,
                    importance_level: merged.importance_level,
                    owner: merged.owner,
                    appearance: merged.appearance,
                    material: merged.material,
                    size: merged.size,
                    color: merged.color,
                    shape: merged.shape,
                    texture: merged.texture,
                    visual_features: merged.visual_features,
                    camera_usage: merged.camera_usage,
                    story_function: merged.story_function,
                    tags: merged.tags,
                  }
                : p,
            ),
          )
          toast.success(`已保存「${merged.name}」（剧本中心）`)
        },
        // === 同步到道具工厂：写入 props 表（独立于剧本中心） ===
        onSyncToFactory: async (merged: PropDetailMerged) => {
          const name = (merged.name || '').trim()
          if (!name) throw new Error('道具名称为空，无法同步')
          if (!projId) {
            log.warn('sync prop to factory without projectId', { name })
          }
          const payload = {
            name,
            category: merged.category,
            description: merged.description,
            appearance: merged.appearance,
            material: merged.material,
            size: merged.size,
            color: merged.color,
            tags: merged.tags,
            image: merged.image,
            // === AI 剧本分析扩展字段 ===
            importance_level: merged.importance_level,
            owner: merged.owner,
            shape: merged.shape,
            texture: merged.texture,
            story_function: merged.story_function,
            visual_features: merged.visual_features,
            camera_usage: merged.camera_usage,
            first_appearance: merged.first_appearance,
          }
          log.info('POST /api/props (sync prop to factory)', { name, projectId: projId, payload })
          let created: any
          try {
            created = await createPropFactory(payload as any)
          } catch (err) {
            const e = err as Error
            // eslint-disable-next-line no-console
            console.error('[page.tsx] sync prop POST failed', { name, projId, payload, err })
            throw e
          }
          log.info('POST /api/props ok', { name, id: created?.id })
          appendFactoryAsset('prop', { ...created, project_id: projId || undefined })
          try {
            getFactoryBus().emit('factory:asset-list-changed', {
              kind: 'prop',
              projectId: projId || undefined,
            })
          } catch (busErr) {
            log.warn('factoryBus emit failed', { error: (busErr as Error).message })
          }
          toast.success(`已同步到道具工厂：「${created.name}」`)
        },
      }
    },
    [currentDocument?.project_id, scriptId, analyzePreview, appendFactoryAsset],
  )

  // ---- 大纲模式：节点点击 / 排序 / 添加 / 删除 / 重命名 ----
  const handleNodeClick = (node: OutlineNode) => {
    log.debug('outline node click', { id: node.id, type: node.type })
    setViewMode('edit')
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${node.id}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
  const handleNodeReorder = async (nodeId: string, newOrder: number): Promise<void> => {
    setOutlineNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === nodeId)
      const tIdx = prev.findIndex((n) => n.order === newOrder)
      if (idx < 0 || tIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(idx, 1)
      next.splice(tIdx, 0, moved)
      return next.map((n, i) => ({ ...n, order: i }))
    })
  }
  const handleAddNode = (type: 'episode' | 'scene' | 'character', parentId?: string) => {
    const newNode: OutlineNode = {
      id: `new-${Date.now()}`,
      type,
      title: type === 'episode' ? '新剧集' : type === 'scene' ? '新场景' : '新角色',
      order: outlineNodes.length,
      children: [],
    }
    if (parentId) {
      const findAndAdd = (nodes: OutlineNode[]): OutlineNode[] =>
        nodes.map((n) =>
          n.id === parentId
            ? { ...n, children: [...(n.children || []), newNode] }
            : n.children
            ? { ...n, children: findAndAdd(n.children) }
            : n,
        )
      setOutlineNodes((prev) => prev.map((n) => (n.children ? { ...n, children: findAndAdd(n.children) } : n)))
    } else {
      setOutlineNodes((prev) => [...prev, newNode])
    }
  }
  const handleNodeDelete = (nodeId: string) => {
    const filterRecursive = (nodes: OutlineNode[]): OutlineNode[] =>
      nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => ({ ...n, children: n.children ? filterRecursive(n.children) : undefined }))
    setOutlineNodes((prev) => filterRecursive(prev))
  }
  const handleNodeRename = (nodeId: string, newTitle: string) => {
    const renameRecursive = (nodes: OutlineNode[]): OutlineNode[] =>
      nodes.map((n) =>
        n.id === nodeId
          ? { ...n, title: newTitle }
          : n.children
          ? { ...n, children: renameRecursive(n.children) }
          : n,
      )
    setOutlineNodes((prev) => renameRecursive(prev))
  }

  // ---- 顶部"评论"按钮：切换右侧面板 Tab 到 'comment' ----
  const handleCommentToggle = useCallback(() => {
    log.debug('toggle comment', { currentTab: rightPanelTab })
    // 若当前是 comment，再次点击切回默认 character；否则切到 comment
    setRightPanelTab((prev) => (prev === 'comment' ? 'character' : 'comment'))
  }, [rightPanelTab])

  // ---- 加载 / 空态 ----
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-0 bg-[#0a0a0a] gap-3">
        <div className="text-emerald-400 animate-pulse text-base">
          正在加载中，请耐心等待…
        </div>
        <div className="text-xs text-[#666]">
          {(typeof window !== 'undefined' && (window as any).__scriptLoadProgress) || '正在请求后端数据'}
        </div>
      </div>
    )
  }
  if (!currentDocument) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-0 bg-[#0a0a0a] gap-4 p-6 text-center max-w-2xl mx-auto">
        <div className="text-[#888] text-base">剧本加载失败</div>
        <div className="text-xs text-[#888] max-w-md leading-relaxed">
          剧本 ID：<code className="text-emerald-400/80">{scriptId}</code>
          <br />
          {error || '可能原因：剧本已删除、后端服务未启动、或该 ID 在数据中找不到对应记录。'}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined') (window as any).__scriptLoadProgress = null
              if (scriptId) loadDocument(scriptId)
            }}
          >
            重试
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const [scriptsRes, docRes] = await Promise.all([
                  fetch('/api/scripts'),
                  fetch(`/api/script-documents/${encodeURIComponent(scriptId)}`),
                ])
                const scripts = await scriptsRes.json()
                const doc = docRes.ok ? await docRes.json() : await docRes.text()
                alert(
                  `/api/scripts: ${scriptsRes.status}\n` +
                    `总剧本数: ${(scripts?.data ?? []).length}\n` +
                    `含此 ID: ${(scripts?.data ?? []).some((s: any) => s.id === scriptId)}\n\n` +
                    `/api/script-documents/${scriptId.slice(0, 16)}...: ${docRes.status}\n` +
                    `响应: ${JSON.stringify(doc).slice(0, 200)}`,
                )
              } catch (err) {
                alert('测试 API 失败：' + (err as Error).message)
              }
            }}
          >
            测试 API
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.close()}
          >
            关闭标签页
          </Button>
        </div>
        <div className="text-[10px] text-[#555] mt-4 leading-relaxed">
          提示：打开浏览器 DevTools → Network 标签，可以查看 <code>/api/scripts</code> 和 <code>/api/script-documents</code> 的请求状态。
          <br />
          常见问题：① SQLite 数据库 <code>backend/data/sqlite.db</code> 的 <code>scripts</code> 表中是否存在此 ID；② <code>script_documents</code> 表是否需要为该剧本补充一条文档记录。
        </div>
      </div>
    )
  }

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="script-edit-page h-full min-h-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* === 顶部工具栏 === */}
      <div className="border-b border-white/10 bg-[#1a1a1a] px-4 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={currentDocument.title || ''}
            onChange={(e) => {
              const next = e.target.value;
              // 方案 A：title 改动通过 saveDocument 写回 script_documents。
              // 局部乐观更新 + 自动保存
              useScriptStore.setState((s) => ({
                currentDocument: s.currentDocument ? { ...s.currentDocument, title: next } : null,
              }));
              setIsDirty(true);
            }}
            onBlur={() => {
              if (isDirty) handleSave();
            }}
            placeholder="未命名剧本"
            className="text-lg font-medium text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500/50 focus:outline-none w-full px-0 py-0"
            aria-label="剧本标题"
          />
          <div className="text-xs text-[#888] mt-0.5">{isSaving ? '保存中...' : isDirty ? '有未保存修改' : '已保存'}</div>
        </div>
        {/* 方案 A：作者 / 状态 inline-edit 下拉，写入时与 saveDocument 一并保存 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={currentDocument.author || ''}
            onChange={(e) => {
              useScriptStore.setState((s) => ({
                currentDocument: s.currentDocument ? { ...s.currentDocument, author: e.target.value } : null,
              }));
              setIsDirty(true);
            }}
            onBlur={() => isDirty && handleSave()}
            placeholder="作者"
            className="text-xs text-white bg-transparent border border-white/10 rounded px-2 py-1 w-28 focus:border-emerald-500/50 focus:outline-none"
            aria-label="作者"
          />
          <select
            value={currentDocument.status || 'draft'}
            onChange={(e) => {
              useScriptStore.setState((s) => ({
                currentDocument: s.currentDocument ? { ...s.currentDocument, status: e.target.value as any } : null,
              }));
              setIsDirty(true);
              handleSave();
            }}
            className="text-xs text-white bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 focus:border-emerald-500/50 focus:outline-none"
            aria-label="状态"
          >
            <option value="draft">草稿</option>
            <option value="active">进行中</option>
            <option value="review">审核中</option>
            <option value="completed">已完成</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaving}>
            保存
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowVersionHistory(true)}>
            历史
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowImportExport(true)}>
            导入导出
          </Button>
          <Button variant={rightPanelTab === 'comment' ? 'default' : 'ghost'} size="sm" onClick={handleCommentToggle}>
            评论
          </Button>
        </div>
      </div>

      {/* === 编辑器工具栏 === */}
      <ScriptToolbar editor={editor} onAnalyze={handleAnalyzeScript} />

      {/* === 主内容区：左（侧栏） + 中（编辑器/大纲） + 右（面板） === */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：剧集/场景导航 */}
        <div className="w-64 flex-shrink-0">
          <ScriptSidebar
            episodes={episodes}
            selectedEpisode={selectedEpisode}
            selectedScene={selectedScene}
            onSelectEpisode={selectEpisode}
            onSelectScene={selectScene}
            onAddEpisode={() => createEpisode({ episodeNo: episodes.length + 1, title: '' } as any)}
            onAddScene={(episodeId) => createScene(episodeId, { location: '', time: '' })}
            onRenameEpisode={(id, title) => updateEpisode(id, { title })}
            onDeleteEpisode={(id) => deleteEpisode(id)}
            onDuplicateEpisode={(id) => {
              const ep = episodes.find((e) => e.id === id)
              if (ep) createEpisode({ episodeNo: episodes.length + 1, title: `${ep.title} (副本)`, synopsis: ep.synopsis } as any)
            }}
            onRenameScene={(id, location, time) => updateScene(id, { location, time })}
            onDeleteScene={(id) => deleteScene(id)}
            onDuplicateScene={(id) => {
              const sc = scenes.find((s) => s.id === id)
              if (sc) createScene(sc.episodeId, { location: `${sc.location} (副本)`, time: sc.time, description: sc.description })
            }}
            treeData={editorTree}
            onJumpToEpisode={jumpToNode('已跳转到剧集', '未在编辑器中找到该剧集')}
            onJumpToScene={jumpToNode('已跳转到场景', '未在编辑器中找到该场景')}
            onReorderEpisodes={(fromId, toId) => {
              const idxFrom = episodes.findIndex((e) => e.id === fromId)
              const idxTo = episodes.findIndex((e) => e.id === toId)
              if (idxFrom < 0 || idxTo < 0) return
              const reordered = [...episodes]
              const [moved] = reordered.splice(idxFrom, 1)
              reordered.splice(idxTo, 0, moved)
              reordered.forEach((ep, i) => updateEpisode(ep.id, { episodeNo: i + 1 }))
              toast.success('剧集顺序已更新')
            }}
          />
        </div>

        {/* 中部：编辑器 / 大纲视图 */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'outline' ? (
            <OutlineView
              nodes={outlineNodes}
              onNodeClick={handleNodeClick}
              onNodeReorder={handleNodeReorder}
              onAddNode={handleAddNode}
              onNodeDelete={handleNodeDelete}
              onNodeRename={handleNodeRename}
              onBackToEdit={() => setViewMode('edit')}
            />
          ) : (
            <ScriptEditor
              document={{
                id: currentDocument.id,
                title: currentDocument.title || '',
                editor_json: currentDocument.editor_json,
              }}
              onSave={(json) => {
                scriptCenterService.updateDocument(currentDocument.id, { editor_json: json })
              }}
              onEditorReady={setEditor}
              onTreeUpdate={setEditorTree}
            />
          )}
        </div>

        {/* 右侧：剧本编辑面板（5 Tab：角色/场景/道具/AI/评论，工厂入口已收敛到组件内） */}
        <ScriptEditRightPanel
          characters={analyzedCharacters.map((c) => analyzedCharToRightPanelShape(c, charImageMap)) as any}
          projectId={currentDocument?.project_id}
          onAddCharacter={() => notify.info('请通过顶部"角色工厂"快捷入口管理角色资产')}
          onSelectCharacter={(char) => {
            if (editor && char.name) editor.commands.setCharacter?.({ name: char.name, color: char.color })
          }}
          onDeleteCharacter={(id) => {
            // 持久化删除：DELETE /api/analyzed-characters/:id，工厂资源不受影响
            setAnalyzedCharacters((prev) => prev.filter((c) => c.id !== id))
            scriptCenterService.deleteAnalyzedCharacter(id).catch((err) => {
              console.error('[右面板] 删除分析角色失败', err)
              notify.error('删除失败：' + (err?.message || '未知错误'))
            })
            notify.info('已从右侧面板移除角色（剧本中心）')
          }}
          onViewCharacterDetail={handleViewCharacterDetail}
          propAssets={analyzedProps.map((p) => analyzedPropToRightPanelShape(p, propImageMap)) as any}
          onAddProp={() => notify.info('请通过顶部"道具工厂"快捷入口管理道具资产')}
          onSelectProp={(p) => {
            if (editor && p.name) editor.commands.insertContent?.(p.name)
          }}
          onDeleteProp={(id) => {
            // 持久化删除：DELETE /api/analyzed-props/:id，工厂资源不受影响
            setAnalyzedProps((prev) => prev.filter((p) => p.id !== id))
            scriptCenterService.deleteAnalyzedProp(id).catch((err) => {
              console.error('[右面板] 删除分析道具失败', err)
              notify.error('删除失败：' + (err?.message || '未知错误'))
            })
            notify.info('已从右侧面板移除道具（剧本中心）')
          }}
          onViewPropDetail={handleViewPropDetail}
          sceneAssets={analyzedScenes.map((s) => analyzedSceneToRightPanelShape(s, sceneImageMap)) as any}
          onAddScene={() => notify.info('请通过顶部"场景工厂"快捷入口管理场景资产')}
          onSelectScene={(scene) => {
            if (editor && scene.name) editor.commands.insertContent?.(scene.name)
          }}
          onDeleteScene={(id) => {
            // 持久化删除：DELETE /api/analyzed-scenes/:id，工厂资源不受影响
            setAnalyzedScenes((prev) => prev.filter((s) => s.id !== id))
            scriptCenterService.deleteAnalyzedScene(id).catch((err) => {
              console.error('[右面板] 删除分析场景失败', err)
              notify.error('删除失败：' + (err?.message || '未知错误'))
            })
            notify.info('已从右侧面板移除场景（剧本中心）')
          }}
          onViewSceneDetail={handleViewSceneDetail}
          editor={editor}
          hasSelection={!!(selectedText && selectionPosition)}
          onGenerateScript={async (params) => {
            const result = await scriptCenterService.generateScript(params)
            if (editor && result.content) editor.commands.setContent(result.content)
            toast.success('AI生成完成')
          }}
          onOptimizeScript={async (params) => {
            const result = await scriptCenterService.optimizeScript({
              content: params.content || undefined,
              optimization_type: params.target as any,
              script_id: params.content ? undefined : currentDocument.id,
            })
            return { optimizedContent: result.optimizedContent || '' }
          }}
          onGenerateScene={async (params) => {
            const result = await scriptCenterService.generateScene(params)
            if (editor && result.description) editor.commands.insertContent(result.description)
            toast.success('场景生成完成')
          }}
          onGenerateDialogue={async (params) => {
            const result = await scriptCenterService.generateDialogue(params)
            if (editor && result.dialogue) editor.commands.insertContent(result.dialogue)
            toast.success('对话生成完成')
          }}
          scriptId={scriptId}
          selectedText={selectedText}
          selectionPosition={selectionPosition}
          activeTab={rightPanelTab}
          onActiveTabChange={setRightPanelTab}
        />
      </div>

      {/* === 弹窗集合（按需渲染） === */}
      {showVersionHistory && (
        <VersionHistoryModal
          onClose={() => setShowVersionHistory(false)}
          versions={versions}
          onRestore={restoreVersion}
          onView={(id) => {
            const v = versions.find((x) => x.id === id)
            if (v) setViewingVersion(v)
          }}
          onDelete={deleteVersion}
          onCompare={async (v1, v2) => scriptCenterService.compareVersions(currentDocument.id, v1, v2)}
        />
      )}

      {viewingVersion && (
        <VersionPreviewModal version={viewingVersion} onClose={() => setViewingVersion(null)} />
      )}

      {showImportExport && (
        <Suspense fallback={<LoadingFallback />}>
          <ImportExportDialog
            isOpen={showImportExport}
            onClose={() => setShowImportExport(false)}
            editorJson={currentDocument.editor_json}
            title={currentDocument.title || '剧本'}
            onExport={(format, content, filename) => {
              const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = filename
              a.click()
              URL.revokeObjectURL(url)
              toast.success('导出成功')
            }}
            onImport={(editorJson) => {
              if (editor) editor.commands.setContent(editorJson)
              toast.success('导入成功')
            }}
          />
        </Suspense>
      )}

      {showAnalyzeConfirm && (
        <ConfirmDialog
          title="AI 分析剧本"
          description="将通过大模型分析当前剧本文本，识别出角色、场景、道具与剧集。分析可能需要数十秒，是否继续？"
          confirmLabel="开始分析"
          onClose={() => setShowAnalyzeConfirm(false)}
          onConfirm={handleConfirmAnalyze}
        />
      )}

      {analyzePreview && (
        <AnalyzePreviewModal
          data={analyzePreview}
          onApply={handleApplyAnalyze}
          onCancel={() => setAnalyzePreview(null)}
          applying={isApplyingAnalyze}
        />
      )}
    </div>
  )
}

// ============================================================
// 局部辅助工具
// ============================================================

/**
 * 通用滚动跳转工厂方法（高内聚）：抽离自原 page.tsx 中的两段重复逻辑
 *
 * 支持两层定位：
 * 1) 结构化定位：编辑器中含 `data-id` 的 episode/scene 节点（AI 拆条 / 手动结构化后）
 * 2) 纯文本回退：编辑器为纯文本时，按剧集标题 / "第N集" / 场景地点 在 .ProseMirror 中检索
 *    最近邻段落，滚动并加高亮
 */
function jumpToNode(successMsg: string, failMsg: string) {
  return (target: string | SidebarJumpTarget) => {
    const nodeId = typeof target === 'string' ? target : target.id
    // 1) 结构化定位：data-id 直接命中
    let el: HTMLElement | null = queryByDataId(nodeId)
    let highlightEls: HTMLElement[] = []
    let via: 'structured' | 'text' = 'structured'
    let targetEpisodeNo: number | undefined

    if (!el) {
      // 2) 纯文本回退：在 store 中找节点元数据，构造候选关键词
      const { episodes, scenes } = useScriptStore.getState()
      const keywords: string[] = []
      const ep = episodes.find((e) => e.id === nodeId)
      const targetMeta = typeof target === 'string' ? null : target
      const targetIsEpisode = targetMeta?.type === 'episode' || targetMeta?.type === 'heading'
      const targetIsScene = targetMeta?.type === 'scene'
      if (ep || targetIsEpisode) {
        const episodeNo = ep?.episodeNo ?? targetMeta?.episodeNo
        targetEpisodeNo = episodeNo
        const title = ep?.title || targetMeta?.title || ''
        if (typeof episodeNo === 'number' && episodeNo > 0) {
          // 兼容多种写法：第1集 / 第01集 / 第一集
          const no = episodeNo
          const cnDigit = toChineseNumber(no)
          keywords.push(`第${no}集`)
          // 前导零写法：第01集、第1集（去前导零后等价）
          if (no < 10) keywords.push(`第0${no}集`)
          if (cnDigit) keywords.push(`第${cnDigit}集`)
        }
        if (title) {
          keywords.push(title)
        }
      } else {
        const sc = scenes.find((s) => s.id === nodeId)
        if (sc || targetIsScene) {
          const location = sc?.location || targetMeta?.location || targetMeta?.title || ''
          const time = sc?.time || targetMeta?.time || ''
          if (location) keywords.push(location)
          if (location && time) {
            // 兼容多种分隔符：· / - / 空格 / 全角空格
            keywords.push(`${location} · ${time}`)
            keywords.push(`${location} - ${time}`)
            keywords.push(`${location} ${time}`)
            keywords.push(`${location}　${time}`)
          }
        }
      }
      el = findBlockByText(keywords)
      if (el) via = 'text'
    }

    if (!el && targetEpisodeNo === 1) {
      el = document.querySelector('.ProseMirror > *') as HTMLElement | null
      via = 'text'
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightEls =
        via === 'text' && targetEpisodeNo
          ? collectEpisodeTextRange(el)
          : [el]
      highlightEls.forEach((targetEl) => targetEl.classList.add('episode-highlight-flash'))
      setTimeout(() => {
        highlightEls.forEach((targetEl) => targetEl.classList.remove('episode-highlight-flash'))
      }, 1500)
      // 第二层定位时通过 toast 文本告知用户，提示内容为文本匹配
      toast.success(
        successMsg,
        via === 'text' ? '已在编辑器中按文本匹配定位' : undefined,
      )
    } else {
      // 3) 完全找不到：滚到顶部 + 提示（让用户知道发生了什么）
      const editorRoot = document.querySelector('.ProseMirror')
      if (editorRoot) {
        // 找到最近的可滚动祖先
        let scrollParent: HTMLElement | null = editorRoot.parentElement
        while (scrollParent && scrollParent !== document.body) {
          const style = window.getComputedStyle(scrollParent)
          if (/(auto|scroll|overlay)/.test(style.overflowY)) break
          scrollParent = scrollParent.parentElement
        }
        if (scrollParent) scrollParent.scrollTo({ top: 0, behavior: 'smooth' })
      }
      toast.error(failMsg + '（已滚到顶部）')
    }
  }
}

function collectEpisodeTextRange(start: HTMLElement): HTMLElement[] {
  const editor = document.querySelector('.ProseMirror') as HTMLElement | null
  if (!editor) return [start]
  const blocks = Array.from(editor.querySelectorAll<HTMLElement>(getEditorBlockSelector()))
  const startIndex = blocks.indexOf(start)
  if (startIndex < 0) return [start]
  const result: HTMLElement[] = []
  for (let i = startIndex; i < blocks.length; i++) {
    const block = blocks[i]
    if (i > startIndex && isEpisodeHeadingBlock(block)) break
    result.push(block)
  }
  return result.length > 0 ? result : [start]
}

function isEpisodeHeadingBlock(block: HTMLElement): boolean {
  const text = normalizeWhitespace(block.textContent || '')
  return /^第(?:0?\d{1,3}|[一二三四五六七八九十]{1,4})集(?:\s|$|[：:，,.-])/.test(text)
}

function queryByDataId(id: string): HTMLElement | null {
  if (!id) return null
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')
  return document.querySelector(`[data-id="${escaped}"]`)
}

/**
 * 阿拉伯数字 → 中文数字（用于兼容「第1集」/「第一集」两种写法）
 * 仅支持 1..99；超过 99 返回 null（不常用，跳过避免误判）
 */
function toChineseNumber(n: number): string | null {
  if (n < 1 || n > 99) return null
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return digits[n]
  if (n === 10) return '十'
  if (n < 20) return `十${digits[n - 10]}`
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`
}

/**
 * 在 .ProseMirror 内部按关键词列表查找首个匹配的块级元素。
 * 增强点：
 *   - 关键词归一化（去除全/半角空格、零宽字符等），降低误判
 *   - "第N集" 关键词额外做段首优先匹配，避免命中"第10集"中间
 *   - 跳过命中所在 block 是其他剧集/场景结构化节点（避免被父节点先吸走）
 */
function findBlockByText(keywords: string[]): HTMLElement | null {
  const editor = document.querySelector('.ProseMirror') as HTMLElement | null
  if (!editor) return null
  const cleaned = keywords
    .map((k) => normalizeWhitespace((k || '').toString()))
    .filter((k) => k.length > 0)
  if (cleaned.length === 0) return null
  // 检索 block 容器：包含自定义节点 + 标准块
  const blocks = editor.querySelectorAll<HTMLElement>(getEditorBlockSelector())

  // 把"第N集"类的关键词单独标记走"段首优先"匹配
  const isEpisodeKey = (k: string) => /^第.{1,4}集$/.test(k)

  for (const keyword of cleaned) {
    const isEp = isEpisodeKey(keyword)
    // 先做一次段首优先扫描：块的 textContent 前 8 个字符（归一化后）包含关键词
    if (isEp) {
      for (const block of Array.from(blocks)) {
        const text = (block.textContent || '').trim()
        if (!text) continue
        const head = normalizeWhitespace(text).slice(0, 8)
        if (head.includes(keyword)) {
          return block
        }
      }
    }
    // 通用包含匹配（兜底）
    for (const block of Array.from(blocks)) {
      const text = (block.textContent || '').trim()
      if (!text) continue
      if (normalizeWhitespace(text).includes(keyword)) {
        return block
      }
    }
  }
  return null
}

function getEditorBlockSelector(): string {
  return 'p, h1, h2, h3, h4, h5, h6, blockquote, li, [data-type="episode"], [data-type="scene"]'
}

/**
 * 归一化空白字符：全角空格 → 半角、多余空白折叠、去除零宽
 * 主要解决"内景/外景"、"第 1 集"等混用全/半角空格带来的关键词 miss
 */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/[\u3000\u2000-\u200a\u2028\u2029]/g, ' ') // 全角空格、hair spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // 零宽字符
    .replace(/\s+/g, ' ')
    .trim()
}
