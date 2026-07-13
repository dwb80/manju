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

import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
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
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { toast } from '@/components/common/toast'
import { notify } from '@/lib/notify'
import { createLogger } from '@/lib/logger'
import { useScriptAnalyze } from '@/components/dashboard/script-center/hooks/useScriptAnalyze'

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

  // AI 分析前的原文快照：用于分析后重建 Tiptap 结构（让剧集/场景与正文锚定）
  const [pendingAnalyzeText, setPendingAnalyzeText] = useState<string>('')
  const [pendingAnalyzeJson, setPendingAnalyzeJson] = useState<any>(null)

  // 评论选区
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ from: number; to: number } | undefined>(undefined)

  // ---- 副作用 ----
  useEffect(() => {
    if (!scriptId) return
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
        }
      : null,
    editor,
    characters: characters as any,
    propAssets: propAssets as any,
    updateScriptCharacter,
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
    }
  }, [applyAnalyze])

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
        <div className="flex-1">
          <h1 className="text-lg font-medium text-white">{currentDocument.title || '未命名剧本'}</h1>
          <div className="text-xs text-[#888]">{isSaving ? '保存中...' : '已保存'}</div>
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

        {/* 右侧：剧本编辑面板（不含场景 Tab，工厂入口已收敛到组件内） */}
        <ScriptEditRightPanel
          characters={characters as any}
          onAddCharacter={() => notify.info('请通过顶部"角色工厂"快捷入口管理角色资产')}
          onSelectCharacter={(char) => {
            if (editor && char.name) editor.commands.setCharacter?.({ name: char.name, color: char.color })
          }}
          onEditCharacter={(char) => {
            if (char.assetId) notify.info(`请在角色工厂中编辑角色 ${char.name}`)
          }}
          onDeleteCharacter={(id) => removeCharacter(id)}
          propAssets={propAssets as any}
          onAddProp={() => notify.info('请通过顶部"道具工厂"快捷入口管理道具资产')}
          onSelectProp={(p) => {
            if (editor && p.name) editor.commands.insertContent?.(p.name)
          }}
          onEditProp={(p) => {
            if (p.assetId) notify.info(`请在道具工厂中编辑道具 ${p.name}`)
          }}
          onDeleteProp={(id) => removeProp(id)}
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
