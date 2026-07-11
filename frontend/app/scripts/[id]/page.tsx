'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X, GripHorizontal, ExternalLink, Edit2, Save, Check } from 'lucide-react'
import { ScriptEditor, ScriptToolbar, ScriptSidebar, OutlineView, CommentSystem, PropPanel } from '@/components/dashboard/script-center'
import type { NavTreeNode } from '@/components/dashboard/script-center'
import { useDraggable } from '@/components/dashboard/script-center/useDraggable'
import { useScriptStore } from '@/lib/stores/script-store'
import type { ScriptVersion } from '@/lib/stores/script-store'
import { scriptCenterService } from '@/services/script-center.service'
import { createCharacter } from '@/services/character.service'
import { createScene as createFactoryScene } from '@/services/scene.service'
import { createProp as createFactoryProp } from '@/services/prop.service'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { toast } from '@/components/common/toast'

// 懒加载右侧面板（用户点击时才加载）
const CharacterPanel = lazy(() =>
  import('@/components/dashboard/script-center/CharacterPanel').then(mod => ({ default: mod.CharacterPanel }))
)
const AIPanel = lazy(() =>
  import('@/components/dashboard/script-center/AIPanel').then(mod => ({ default: mod.AIPanel }))
)
const VersionHistory = lazy(() =>
  import('@/components/dashboard/script-center/VersionHistory').then(mod => ({ default: mod.VersionHistory }))
)
const ImportExportDialog = lazy(() =>
  import('@/components/dashboard/script-center/ImportExportDialog').then(mod => ({ default: mod.ImportExportDialog }))
)

// 简单的加载占位符
function LoadingFallback() {
  return <div className="p-4 text-center text-gray-400">加载中...</div>
}

// 从 editor_json 中提取纯文本用于版本预览
function extractTextFromEditorJson(content: any): string {
  if (!content) return '（无内容）'
  let json = content
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json)
    } catch {
      return json
    }
  }
  // 兼容后端 ScriptBackup.content 结构
  if (json.script_document) {
    return extractTextFromEditorJson(json.script_document)
  }
  if (json.editor_json) {
    return extractTextFromEditorJson(json.editor_json)
  }
  const blocks: string[] = []
  const collectText = (node: any): string => {
    if (!node) return ''
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.content)) {
      return node.content.map((child: any) => collectText(child)).join('')
    }
    return ''
  }
  const walk = (node: any) => {
    if (!node) return
    if (['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'].includes(node.type)) {
      blocks.push(collectText(node))
      return
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child: any) => walk(child))
    } else if (typeof node.text === 'string') {
      blocks.push(node.text)
    }
  }
  walk(json)
  return blocks.join('\n') || '（无文本内容）'
}

// 大纲节点类型（与 OutlineView 组件接口一致）
interface OutlineNode {
  id: string
  type: 'episode' | 'scene' | 'character'
  title: string
  subtitle?: string
  children?: OutlineNode[]
  order: number
}

// 评论与回复类型（已迁到 CommentSystem 内部管理，page.tsx 不再持有本地状态）

// 将编辑器导航树（NavTreeNode[]）转换为大纲视图节点（OutlineNode[]）
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
      children:
        node.children && node.children.length > 0
          ? convertNavTreeToOutline(node.children)
          : undefined,
      order: index,
    }
  })
}

export default function ScriptEditPage() {
  const params = useParams()
  const router = useRouter()
  const scriptId = params.id as string

  const {
    currentDocument,
    episodes,
    scenes,
    characters,
    props: propAssets,
    versions,
    selectedEpisode,
    selectedScene,
    isSaving,
    isLoading,
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
    loadVersions,
    restoreVersion,
    deleteVersion,
  } = useScriptStore()

  const [showImportExport, setShowImportExport] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [activePanel, setActivePanel] = useState<'character' | 'prop' | 'ai' | 'comment'>('character')
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null)
  // 分析剧本的确认对话框
  const [showAnalyzeConfirm, setShowAnalyzeConfirm] = useState(false)
  // 分析结果预览（确认后才会写入）
  const [analyzePreview, setAnalyzePreview] = useState<{
    characters: any[]
    scenes: any[]
    props: any[]
    episodes: any[]
    source?: 'ai' | 'local'
    warnings?: string[]
  } | null>(null)

  // 编辑器实例
  const [editor, setEditor] = useState<any>(null)
  // 编辑器实时导航树（Feature 2.10）
  const [editorTree, setEditorTree] = useState<NavTreeNode[]>([])

  // 大纲模式（Feature 2.1）
  const [viewMode, setViewMode] = useState<'edit' | 'outline'>('edit')
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([])

  // 评论批注（Feature 2.9）- 数据由 CommentSystem 通过 API 自管理
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ from: number; to: number } | undefined>(undefined)

  // 弹窗拖拽（版本历史 + 版本预览）
  const versionHistoryDrag = useDraggable(-1, 60)
  const versionPreviewDrag = useDraggable(-1, 60)

  // 加载剧本文档
  useEffect(() => {
    if (scriptId) {
      loadDocument(scriptId)
    }
  }, [scriptId, loadDocument])

  // 加载版本历史
  useEffect(() => {
    if (currentDocument && showVersionHistory) {
      loadVersions()
    }
  }, [currentDocument, showVersionHistory, loadVersions])

  // 进入大纲模式时，从 editorTree 生成大纲数据（Feature 2.1）
  useEffect(() => {
    if (viewMode === 'outline') {
      setOutlineNodes(convertNavTreeToOutline(editorTree))
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 跟踪编辑器选中文本（用于评论功能 Feature 2.9）
  useEffect(() => {
    if (!editor) return
    const updateSelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        setSelectedText(text)
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

  // 保存剧本（含同步角色/场景/道具到工厂）
  const handleSave = async () => {
    if (!currentDocument) return
    try {
      // 1. 保存剧本文档
      await scriptCenterService.updateDocument(currentDocument.id, {
        editor_json: editor?.getJSON()
      })

      // 2. 同步角色到角色工厂
      const projectId = currentDocument.project_id || ''
      let syncedChars = 0
      for (const char of characters) {
        if (char.assetId) continue // 已同步过
        try {
          const created = await createCharacter({
            name: char.name || '未命名角色',
            role: 'supporting',
            description: char.description,
            tags: [],
          })
          updateScriptCharacter(char.id, { assetId: created.id })
          syncedChars++
        } catch (err) {
          console.warn('同步角色失败:', char.name, err)
        }
      }

      // 3. 同步场景到场景工厂
      let syncedScenes = 0
      for (const sc of scenes) {
        if (sc.assetId) continue
        try {
          const created = await createFactoryScene({
            name: sc.location || '未命名场景',
            type: 'outdoor',
            description: sc.description,
            time_of_day: sc.time,
          })
          updateScene(sc.id, { assetId: created.id })
          syncedScenes++
        } catch (err) {
          console.warn('同步场景失败:', sc.location, err)
        }
      }

      // 4. 同步道具到道具工厂
      let syncedProps = 0
      for (const p of propAssets) {
        if (p.assetId) continue
        try {
          const created = await createFactoryProp({
            name: p.name || '未命名道具',
            category: (p.category as any) || 'other',
            description: p.description,
          })
          updateScriptProp(p.id, { assetId: created.id })
          syncedProps++
        } catch (err) {
          console.warn('同步道具失败:', p.name, err)
        }
      }

      // 5. 创建版本快照
      try {
        await fetch('/api/script-versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: currentDocument.id,
            editor_json: JSON.stringify(editor?.getJSON()),
            version: currentDocument.version + 1,
            changes: '保存',
          }),
        })
      } catch {
        // 版本快照失败不阻塞保存
      }

      const total = syncedChars + syncedScenes + syncedProps
      if (total > 0) {
        toast.success('剧本已保存', `已同步 ${syncedChars} 个角色、${syncedScenes} 个场景、${syncedProps} 个道具到工厂`)
      } else {
        toast.success('剧本已保存')
      }
    } catch (error) {
      toast.error('保存失败：' + (error as Error).message)
    }
  }

  // AI分析剧本 - 第一步：弹出确认对话框
  const handleAnalyzeScript = () => {
    if (!editor || !currentDocument) return
    const content = editor.getText()
    if (!content.trim()) {
      toast.error('请先输入剧本内容')
      return
    }
    setShowAnalyzeConfirm(true)
  }

  // AI分析剧本 - 第二步：确认后调用大模型
  const handleConfirmAnalyze = async () => {
    if (!editor || !currentDocument) return
    setShowAnalyzeConfirm(false)
    const content = editor.getText()
    const charCount = content.length
    toast.success(`正在分析剧本…（共 ${charCount} 字）`)
    try {
      const result = await scriptCenterService.analyzeScript(content)
      setAnalyzePreview({
        characters: result.characters || [],
        scenes: result.scenes || [],
        props: result.props || [],
        episodes: result.episodes || [],
        source: result.source,
        warnings: result.warnings,
      })
      if (result.source === 'local') {
        toast.success('AI 不可用，已使用本地正则分析')
      } else {
        toast.success('AI 分析完成，请确认结果')
      }
    } catch (error) {
      toast.error('分析失败：' + (error as Error).message)
    }
  }

  // AI分析剧本 - 第三步：应用分析结果
  const handleApplyAnalyze = async () => {
    if (!analyzePreview) return
    try {
      // 剧集去重添加
      for (const ep of analyzePreview.episodes) {
        const existing = episodes.find((e) => e.title === ep.title)
        if (!existing) {
          await createEpisode({
            episodeNo: ep.episode_no,
            title: ep.title,
            synopsis: ep.synopsis,
          })
        }
      }

      // 角色去重添加（写入 store）
      for (const char of analyzePreview.characters) {
        const existing = characters.find((c) => c.name === char.name)
        if (!existing) {
          addCharacter({
            id: `temp-${Date.now()}-${char.name}`,
            name: char.name,
            description: char.description,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
          })
        }
      }

      // 场景去重添加（写入 store；作为第一个剧集的场景）
      const targetEpisodes = episodes.length > 0 ? episodes : (await new Promise<any[]>((resolve) => {
        // 等待 episodes 更新
        setTimeout(() => resolve(useScriptStore.getState().episodes), 100)
      }))
      for (const scene of analyzePreview.scenes) {
        const existing = scenes.find((s) => s.location === scene.location_name)
        if (!existing && targetEpisodes.length > 0) {
          await createScene(targetEpisodes[0].id, {
            location: scene.location_name,
            time: scene.time_of_day,
            description: scene.description,
          })
        }
      }

      // 道具去重添加
      for (const p of analyzePreview.props) {
        const existing = propAssets.find((pp) => pp.name === p.name)
        if (!existing) {
          addProp({
            id: `temp-${Date.now()}-${p.name}`,
            name: p.name,
            category: p.category,
            description: p.description,
          })
        }
      }

      toast.success(
        `分析结果已应用！识别出 ${analyzePreview.characters.length} 个角色、${analyzePreview.scenes.length} 个场景、${analyzePreview.props.length} 个道具、${analyzePreview.episodes.length} 个剧集`
      )
      setAnalyzePreview(null)
    } catch (error) {
      toast.error('应用失败：' + (error as Error).message)
    }
  }

  // ============ 大纲模式处理（Feature 2.1） ============
  const handleNodeClick = (node: OutlineNode) => {
    // 切回编辑模式并跳转到对应节点
    setViewMode('edit')
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${node.id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  const handleNodeReorder = async (nodeId: string, newOrder: number) => {
    setOutlineNodes((prev) => {
      const index = prev.findIndex((n) => n.id === nodeId)
      if (index === -1) return prev
      const targetIndex = prev.findIndex((n) => n.order === newOrder)
      if (targetIndex === -1) return prev
      const newNodes = [...prev]
      const [moved] = newNodes.splice(index, 1)
      newNodes.splice(targetIndex, 0, moved)
      return newNodes.map((n, i) => ({ ...n, order: i }))
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
      setOutlineNodes((prev) =>
        prev.map((n) => {
          if (n.id === parentId) {
            return { ...n, children: [...(n.children || []), newNode] }
          }
          // 递归查找父节点
          if (n.children) {
            const findAndAdd = (nodes: OutlineNode[]): OutlineNode[] =>
              nodes.map((child) => {
                if (child.id === parentId) {
                  return { ...child, children: [...(child.children || []), newNode] }
                }
                if (child.children) {
                  return { ...child, children: findAndAdd(child.children) }
                }
                return child
              })
            return { ...n, children: findAndAdd(n.children) }
          }
          return n
        })
      )
    } else {
      setOutlineNodes((prev) => [...prev, newNode])
    }
  }

  const handleNodeDelete = (nodeId: string) => {
    setOutlineNodes((prev) => {
      const filterRecursive = (nodes: OutlineNode[]): OutlineNode[] =>
        nodes
          .filter((n) => n.id !== nodeId)
          .map((n) => ({
            ...n,
            children: n.children ? filterRecursive(n.children) : undefined,
          }))
      return filterRecursive(prev)
    })
  }

  const handleNodeRename = (nodeId: string, newTitle: string) => {
    setOutlineNodes((prev) => {
      const renameRecursive = (nodes: OutlineNode[]): OutlineNode[] =>
        nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, title: newTitle }
          }
          if (n.children) {
            return { ...n, children: renameRecursive(n.children) }
          }
          return n
        })
      return renameRecursive(prev)
    })
  }

  // ============ 评论批注处理（Feature 2.9）============
  // 已迁移到 CommentSystem 内部通过 API 持久化，page.tsx 只传递必要 props。

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-[#0a0a0a]">
        <div className="text-emerald-400 animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-[#0a0a0a] text-[#888]">
        剧本不存在或已删除
      </div>
    )
  }

  return (
    <div className="script-edit-page h-full min-h-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="border-b border-white/10 bg-[#1a1a1a] px-4 py-2 flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-lg font-medium text-white">{currentDocument.title || '未命名剧本'}</h1>
          <div className="text-xs text-[#888]">
            {isSaving ? '保存中...' : '已保存'}
          </div>
        </div>

        {/* 工具按钮 - 使用文本而非图标 */}
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
          <Button
            variant={viewMode === 'outline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'outline' ? 'edit' : 'outline')}
          >
            大纲
          </Button>
          <Button
            variant={activePanel === 'comment' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActivePanel(activePanel === 'comment' ? 'character' : 'comment')}
          >
            评论
          </Button>
        </div>
      </div>

      {/* 编辑器工具栏 */}
      <ScriptToolbar 
        editor={editor} 
        onAnalyze={handleAnalyzeScript}
      />

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航 */}
        <div className="w-64 flex-shrink-0">
          <ScriptSidebar
            episodes={episodes}
            selectedEpisode={selectedEpisode}
            selectedScene={selectedScene}
            onSelectEpisode={selectEpisode}
            onSelectScene={selectScene}
            onAddEpisode={() => createEpisode({ episodeNo: episodes.length + 1, title: '' })}
            onAddScene={(episodeId) => createScene(episodeId, { location: '', time: '' })}
            onRenameEpisode={(id, title) => updateEpisode(id, { title })}
            onDeleteEpisode={(id) => deleteEpisode(id)}
            onDuplicateEpisode={(id) => {
              const ep = episodes.find((e) => e.id === id)
              if (ep) createEpisode({ episodeNo: episodes.length + 1, title: `${ep.title} (副本)`, synopsis: ep.synopsis })
            }}
            onRenameScene={(id, location, time) => updateScene(id, { location, time })}
            onDeleteScene={(id) => deleteScene(id)}
            onDuplicateScene={(id) => {
              const sc = scenes.find((s) => s.id === id)
              if (sc) createScene(sc.episodeId, { location: `${sc.location} (副本)`, time: sc.time, description: sc.description })
            }}
            treeData={editorTree}
            onJumpToEpisode={(nodeId) => {
              // 通过 data-id 定位编辑器内对应 DOM 节点并滚动（Feature 2.10）
              const el = document.querySelector(`[data-id="${nodeId}"]`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // 添加高亮闪烁
                el.classList.add('episode-highlight-flash')
                setTimeout(() => el.classList.remove('episode-highlight-flash'), 1500)
                toast.success('已跳转到剧集')
              } else {
                toast.error('未在编辑器中找到该剧集')
              }
            }}
            onJumpToScene={(nodeId) => {
              const el = document.querySelector(`[data-id="${nodeId}"]`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('episode-highlight-flash')
                setTimeout(() => el.classList.remove('episode-highlight-flash'), 1500)
                toast.success('已跳转到场景')
              } else {
                toast.error('未在编辑器中找到该场景')
              }
            }}
            onReorderEpisodes={(fromId, toId) => {
              // 交换 episodes 数组中的位置（Feature 1.5 AC3）
              const idxFrom = episodes.findIndex((e) => e.id === fromId)
              const idxTo = episodes.findIndex((e) => e.id === toId)
              if (idxFrom < 0 || idxTo < 0) return
              const reordered = [...episodes]
              const [moved] = reordered.splice(idxFrom, 1)
              reordered.splice(idxTo, 0, moved)
              // 更新 episodeNo
              reordered.forEach((ep, i) => updateEpisode(ep.id, { episodeNo: i + 1 }))
              toast.success('剧集顺序已更新')
            }}
          />
        </div>

        {/* 编辑器 / 大纲视图（Feature 2.1） */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'outline' ? (
            <OutlineView
              nodes={outlineNodes}
              onNodeClick={handleNodeClick}
              onNodeReorder={handleNodeReorder}
              onAddNode={handleAddNode}
              onNodeDelete={handleNodeDelete}
              onNodeRename={handleNodeRename}
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

        {/* 右侧面板 - 固定显示，Tab切换内容 */}
        <div className="w-80 flex-shrink-0 bg-[#1a1a1a] border-l border-white/10 flex flex-col overflow-hidden">
          {/* Tab 切换栏 */}
          <div className="flex border-b border-white/10 bg-[#1a1a1a]">
            <Button
              variant={activePanel === 'character' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-9 text-xs rounded-none"
              onClick={() => setActivePanel('character')}
            >
              角色
            </Button>
            <Button
              variant={activePanel === 'prop' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-9 text-xs rounded-none"
              onClick={() => setActivePanel('prop')}
            >
              道具
            </Button>
            <Button
              variant={activePanel === 'ai' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-9 text-xs rounded-none"
              onClick={() => setActivePanel('ai')}
            >
              AI
            </Button>
            <Button
              variant={activePanel === 'comment' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-9 text-xs rounded-none"
              onClick={() => setActivePanel('comment')}
            >
              评论
            </Button>
          </div>

          {/* 顶部"在工厂中编辑"快捷入口 */}
          <div className="flex border-b border-white/10 bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => router.push('/characters')}
              className="flex-1 flex items-center justify-center gap-1 h-7 text-[10px] text-emerald-400 hover:bg-white/5"
            >
              <ExternalLink className="h-3 w-3" />
              角色工厂
            </button>
            <button
              type="button"
              onClick={() => router.push('/scenes')}
              className="flex-1 flex items-center justify-center gap-1 h-7 text-[10px] text-emerald-400 hover:bg-white/5 border-l border-white/10"
            >
              <ExternalLink className="h-3 w-3" />
              场景工厂
            </button>
            <button
              type="button"
              onClick={() => router.push('/props')}
              className="flex-1 flex items-center justify-center gap-1 h-7 text-[10px] text-emerald-400 hover:bg-white/5 border-l border-white/10"
            >
              <ExternalLink className="h-3 w-3" />
              道具工厂
            </button>
          </div>

          {/* 面板内容区 */}
          <div className="flex-1 overflow-y-auto">
            {/* 角色面板（只读 + 跳转工厂编辑） */}
            {activePanel === 'character' && (
              <Suspense fallback={<LoadingFallback />}>
                <CharacterPanel
                  characters={characters}
                  onAddCharacter={() => router.push('/characters')}
                  onSelectCharacter={(char) => {
                    if (editor && char.name) {
                      editor.commands.setCharacter?.({ name: char.name, color: char.color })
                    }
                  }}
                  onEditCharacter={(char) => {
                    // 跳转到角色工厂编辑对应角色
                    if (char.assetId) {
                      router.push(`/characters?focus=${char.assetId}`)
                    } else {
                      router.push('/characters')
                    }
                  }}
                  onDeleteCharacter={(id) => removeCharacter(id)}
                />
              </Suspense>
            )}

            {/* 道具面板（只读 + 跳转工厂编辑） */}
            {activePanel === 'prop' && (
              <Suspense fallback={<LoadingFallback />}>
                <PropPanel
                  props={propAssets}
                  onAddProp={() => router.push('/props')}
                  onSelectProp={(p) => {
                    if (editor && p.name) {
                      editor.commands.insertContent?.(p.name)
                    }
                  }}
                  onEditProp={(p) => {
                    if (p.assetId) {
                      router.push(`/props?focus=${p.assetId}`)
                    } else {
                      router.push('/props')
                    }
                  }}
                  onDeleteProp={(id) => removeProp(id)}
                />
              </Suspense>
            )}

            {/* AI面板 */}
            {activePanel === 'ai' && (
              <Suspense fallback={<LoadingFallback />}>
                <AIPanel
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
                />
              </Suspense>
            )}

            {/* 评论面板 */}
            {activePanel === 'comment' && (
              <CommentSystem
                scriptId={scriptId}
                selectedText={selectedText}
                selectionPosition={selectionPosition}
              />
            )}
          </div>
        </div>
      </div>

      {/* 版本历史 - 懒加载 */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div
            className="absolute w-[500px] max-h-[600px] bg-[#1a1a1a] rounded-lg border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            style={{ left: versionHistoryDrag.position.x, top: versionHistoryDrag.position.y }}
          >
            {/* 标题栏 —— 拖拽手柄 */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#252525] cursor-move select-none"
              onMouseDown={versionHistoryDrag.onDragStart}
            >
              <div className="flex items-center gap-2">
                <GripHorizontal className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-200">版本历史</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionHistory(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <Suspense fallback={<LoadingFallback />}>
                <VersionHistory
                  versions={versions}
                  onRestore={async (versionId) => {
                    await restoreVersion(versionId)
                    setShowVersionHistory(false)
                  }}
                  onView={(versionId) => {
                    const version = versions.find((v) => v.id === versionId)
                    if (version) setViewingVersion(version)
                  }}
                  onDelete={async (versionId) => {
                    await deleteVersion(versionId)
                    toast.success('版本已删除')
                  }}
                  onCompare={async (versionId1, versionId2) => {
                    return await scriptCenterService.compareVersions(currentDocument.id, versionId1, versionId2)
                  }}
                />
              </Suspense>
              <Button variant="ghost" onClick={() => setShowVersionHistory(false)} className="mt-2 w-full">
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 版本内容预览弹窗 */}
      {viewingVersion && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div
            className="absolute bg-[#1a1a1a] rounded-lg border border-white/10 shadow-2xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col"
            style={{ left: versionPreviewDrag.position.x, top: versionPreviewDrag.position.y }}
          >
            {/* 标题栏 —— 拖拽手柄 */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#252525] cursor-move select-none"
              onMouseDown={versionPreviewDrag.onDragStart}
            >
              <div className="flex items-center gap-2">
                <GripHorizontal className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-white">
                  版本 V{viewingVersion.version} - {new Date(viewingVersion.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingVersion(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {viewingVersion.changes && (
              <div className="text-xs text-[#888] px-4 pt-2">{viewingVersion.changes}</div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs text-[#ccc] whitespace-pre-wrap">
                {extractTextFromEditorJson(viewingVersion.content)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 导入导出对话框 */}
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
              if (editor) {
                editor.commands.setContent(editorJson)
              }
              toast.success('导入成功')
            }}
          />
        </Suspense>
      )}

      {/* 分析剧本确认对话框 */}
      {showAnalyzeConfirm && (
        <ConfirmDialog
          title="AI 分析剧本"
          description="将通过大模型分析当前剧本文本，识别出角色、场景、道具与剧集。分析可能需要数十秒，是否继续？"
          confirmLabel="开始分析"
          onClose={() => setShowAnalyzeConfirm(false)}
          onConfirm={handleConfirmAnalyze}
        />
      )}

      {/* 分析结果预览对话框 */}
      {analyzePreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-[640px] max-h-[80vh] bg-[#1a1a1a] rounded-lg border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-medium text-white flex items-center gap-2">
                AI 分析结果
                {analyzePreview.source === 'ai' ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    AI
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    本地正则
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setAnalyzePreview(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {analyzePreview.warnings && analyzePreview.warnings.length > 0 && (
              <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs">
                {analyzePreview.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div>
                <div className="text-emerald-400 font-medium mb-2">
                  识别出 {analyzePreview.characters.length} 个角色
                </div>
                {analyzePreview.characters.length > 0 ? (
                  <ul className="space-y-1 text-[#ccc]">
                    {analyzePreview.characters.map((c: any, idx: number) => (
                      <li key={idx} className="px-2 py-1 rounded bg-white/5">
                        <span className="text-white">{c.name}</span>
                        {c.description && <span className="text-[#888] ml-2">- {c.description}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[#666]">未识别到角色</div>
                )}
              </div>
              <div>
                <div className="text-emerald-400 font-medium mb-2">
                  识别出 {analyzePreview.scenes.length} 个场景
                </div>
                {analyzePreview.scenes.length > 0 ? (
                  <ul className="space-y-1 text-[#ccc]">
                    {analyzePreview.scenes.map((s: any, idx: number) => (
                      <li key={idx} className="px-2 py-1 rounded bg-white/5">
                        <span className="text-white">{s.location_name}</span>
                        {s.time_of_day && <span className="text-[#888] ml-2">- {s.time_of_day}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[#666]">未识别到场景</div>
                )}
              </div>
              <div>
                <div className="text-emerald-400 font-medium mb-2">
                  识别出 {analyzePreview.props.length} 个道具
                </div>
                {analyzePreview.props.length > 0 ? (
                  <ul className="space-y-1 text-[#ccc]">
                    {analyzePreview.props.map((p: any, idx: number) => (
                      <li key={idx} className="px-2 py-1 rounded bg-white/5">
                        <span className="text-white">{p.name}</span>
                        {p.description && <span className="text-[#888] ml-2">- {p.description}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[#666]">未识别到道具</div>
                )}
              </div>
              <div>
                <div className="text-emerald-400 font-medium mb-2">
                  识别出 {analyzePreview.episodes.length} 个剧集
                </div>
                {analyzePreview.episodes.length > 0 ? (
                  <ul className="space-y-1 text-[#ccc]">
                    {analyzePreview.episodes.map((e: any, idx: number) => (
                      <li key={idx} className="px-2 py-1 rounded bg-white/5">
                        <span className="text-white">第{e.episode_no}集 - {e.title}</span>
                        {e.synopsis && <span className="text-[#888] ml-2">- {e.synopsis}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[#666]">未识别到剧集（将使用整篇内容）</div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAnalyzePreview(null)}>
                取消
              </Button>
              <Button size="sm" onClick={handleApplyAnalyze} className="bg-emerald-500 hover:bg-emerald-600">
                <Check className="mr-1 h-3 w-3" />
                应用结果
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}