'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronRight,
  ChevronDown,
  FileText,
  Film,
} from 'lucide-react'
import type { NavTreeNode } from './ScriptEditor'

export interface SidebarJumpTarget {
  id: string
  type: 'episode' | 'scene' | 'heading'
  title?: string
  episodeNo?: number
  location?: string
  time?: string
}

interface Episode {
  id: string
  episodeNo: number
  title: string
  synopsis?: string
  status?: string
  scenes: Scene[]
}

interface Scene {
  id: string
  location: string
  time: string
  description?: string
}

interface ScriptSidebarProps {
  episodes: Episode[]
  selectedEpisode: string | null
  selectedScene: string | null
  onSelectEpisode: (id: string | null) => void
  onSelectScene: (id: string | null) => void
  onAddEpisode: () => void
  onAddScene: (episodeId: string) => void
  onRenameEpisode?: (id: string, title: string) => void
  onDeleteEpisode?: (id: string) => void
  onDuplicateEpisode?: (id: string) => void
  onRenameScene?: (id: string, location: string, time: string) => void
  onDeleteScene?: (id: string) => void
  onDuplicateScene?: (id: string) => void
  /** 跳转到指定锚点（编辑器内对应节点） */
  onJumpToEpisode?: (target: string | SidebarJumpTarget) => void
  onJumpToScene?: (target: string | SidebarJumpTarget) => void
  /** 编辑器实时导航树（Feature 2.10，存在时优先于 episodes 渲染） */
  treeData?: NavTreeNode[]
  /** 拖拽排序回调（Feature 1.5 AC3） */
  onReorderEpisodes?: (fromId: string, toId: string) => void
}

type MenuItem =
  | { kind: 'episode'; episode: Episode }
  | { kind: 'scene'; scene: Scene; episodeId: string }

export function ScriptSidebar({
  episodes,
  selectedEpisode,
  selectedScene,
  onSelectEpisode,
  onSelectScene,
  onAddEpisode,
  onAddScene,
  onRenameEpisode,
  onDeleteEpisode,
  onDuplicateEpisode,
  onRenameScene,
  onDeleteScene,
  onDuplicateScene,
  onJumpToEpisode,
  onJumpToScene,
  treeData,
  onReorderEpisodes,
}: ScriptSidebarProps) {
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set())
  // 编辑器实时树优先（Feature 2.10）；为空时回退到 episodes
  const useTreeData = false
  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MenuItem } | null>(null)
  // 重命名状态
  const [renaming, setRenaming] = useState<{ id: string; type: 'episode' | 'scene'; value: string; sceneTime?: string } | null>(null)
  // 拖拽排序状态
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const displayEpisodes = useMemo(() => {
    const seen = new Set<string>()
    return episodes.filter((episode) => {
      const key = `${episode.episodeNo || ''}::${(episode.title || '').trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [episodes])

  const toggleEpisode = (episodeId: string) => {
    const newExpanded = new Set(expandedEpisodes)
    if (newExpanded.has(episodeId)) {
      newExpanded.delete(episodeId)
    } else {
      newExpanded.add(episodeId)
    }
    setExpandedEpisodes(newExpanded)
  }

  // 关闭右键菜单（点击外部）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // 重命名输入框聚焦
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renaming])

  const handleContextMenu = (e: React.MouseEvent, item: MenuItem) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, item })
  }

  const startRenameEpisode = (episode: Episode) => {
    setRenaming({ id: episode.id, type: 'episode', value: episode.title })
    setContextMenu(null)
  }

  const startRenameScene = (scene: Scene) => {
    setRenaming({ id: scene.id, type: 'scene', value: scene.location, sceneTime: scene.time })
    setContextMenu(null)
  }

  const confirmRename = useCallback(() => {
    if (!renaming) return
    if (renaming.type === 'episode' && onRenameEpisode) {
      onRenameEpisode(renaming.id, renaming.value)
    } else if (renaming.type === 'scene' && onRenameScene) {
      onRenameScene(renaming.id, renaming.value, renaming.sceneTime ?? 'day')
    }
    setRenaming(null)
  }, [renaming, onRenameEpisode, onRenameScene])

  const cancelRename = () => setRenaming(null)

  const handleDuplicate = () => {
    if (!contextMenu) return
    if (contextMenu.item.kind === 'episode' && onDuplicateEpisode) {
      onDuplicateEpisode(contextMenu.item.episode.id)
    } else if (contextMenu.item.kind === 'scene' && onDuplicateScene) {
      onDuplicateScene(contextMenu.item.scene.id)
    }
    setContextMenu(null)
  }

  const handleDelete = () => {
    if (!contextMenu) return
    if (contextMenu.item.kind === 'episode' && onDeleteEpisode) {
      if (confirm(`确定删除"${contextMenu.item.episode.title || `第${contextMenu.item.episode.episodeNo}集`}"？`)) {
        onDeleteEpisode(contextMenu.item.episode.id)
      }
    } else if (contextMenu.item.kind === 'scene' && onDeleteScene) {
      if (confirm('确定删除该场景？')) {
        onDeleteScene(contextMenu.item.scene.id)
      }
    }
    setContextMenu(null)
  }

  const statusColors: Record<string, string> = {
    draft: 'text-gray-400',
    review: 'text-yellow-400',
    approved: 'text-emerald-400',
    production: 'text-blue-400',
  }

  const toJumpTarget = (node: NavTreeNode): SidebarJumpTarget => ({
    id: node.id,
    type: node.type,
    title: node.title,
    episodeNo: node.episodeNo,
    location: node.location,
    time: node.time,
  })

  return (
    <div className="script-sidebar h-full bg-[#1a1a1a] border-r border-white/10 flex flex-col">
      {/* 标题和添加按钮 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">剧集列表</h2>
        <Button variant="ghost" size="sm" onClick={onAddEpisode} className="h-6 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          添加剧集
        </Button>
      </div>

      {/* 剧集列表 */}
      <div className="flex-1 overflow-y-auto">
        {useTreeData ? (
          <div className="p-2 space-y-1">
            {treeData!.map((node) => {
              if (node.type === 'episode') {
                const childScenes = node.children.filter((c) => c.type === 'scene')
                return (
                  <div key={node.id} className="rounded-lg overflow-hidden">
                    <div
                      className={`flex items-center gap-1 p-2 rounded cursor-pointer transition-colors ${
                        selectedEpisode === node.id
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'hover:bg-white/5 text-gray-300'
                      }`}
                      onClick={() => {
                        // 单击：选中 + 跳转
                        onSelectEpisode(node.id)
                        onJumpToEpisode?.(toJumpTarget(node))
                      }}
                    >
                      {/* 展开/折叠按钮：单独处理，避免和跳转冲突 */}
                      <button
                        className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEpisode(node.id)
                        }}
                        aria-label={expandedEpisodes.has(node.id) ? '折叠场景' : '展开场景'}
                      >
                        {expandedEpisodes.has(node.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                      <FileText className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white truncate">
                            第{node.episodeNo ?? 1}集
                          </span>
                          {node.title && (
                            <span className="text-xs text-[#888] truncate">- {node.title}</span>
                          )}
                        </div>
                      </div>
                      {node.status && (
                        <span className={`text-xs ${statusColors[node.status] || 'text-gray-400'}`}>
                          ●
                        </span>
                      )}
                    </div>
                    {expandedEpisodes.has(node.id) && childScenes.length > 0 && (
                      <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-2">
                        {childScenes.map((scene) => (
                          <div
                            key={scene.id}
                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm transition-colors ${
                              selectedScene === scene.id
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'hover:bg-white/5 text-gray-400'
                            }`}
                            onClick={() => {
                              onSelectScene(scene.id)
                              onJumpToScene?.(toJumpTarget(scene))
                            }}
                          >
                            <span className="text-gray-500 text-xs">景</span>
                            <span className="text-xs truncate">
                              {scene.location || '未命名'}{scene.time ? ' · ' + scene.time : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              if (node.type === 'scene') {
                return (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${
                      selectedScene === node.id
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                    onClick={() => {
                      onSelectScene(node.id)
                      onJumpToScene?.(toJumpTarget(node))
                    }}
                  >
                    <span className="text-gray-500 text-xs">景</span>
                    <span className="text-xs truncate">
                      {node.location || '未命名'}{node.time ? ' · ' + node.time : ''}
                    </span>
                  </div>
                )
              }
              // heading 节点
              return (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors hover:bg-white/5 text-gray-300"
                  onClick={() => onJumpToEpisode?.(toJumpTarget(node))}
                >
                  <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs truncate">{node.title}</span>
                </div>
              )
            })}
          </div>
        ) : displayEpisodes.length === 0 ? (
          <div className="p-4 text-center text-[#888] text-sm">
            <Film className="h-8 w-8 mx-auto mb-2 opacity-40" />
            暂无剧集，点击上方按钮添加
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displayEpisodes.map((episode) => (
              <div
                key={episode.id}
                className={`rounded-lg overflow-hidden ${draggedId === episode.id ? 'opacity-40' : ''} ${dragOverId === episode.id ? 'border-t-2 border-emerald-500' : ''}`}
              >
                {/* 剧集标题 */}
                <div
                  draggable={!!onReorderEpisodes}
                  onDragStart={(e) => {
                    setDraggedId(episode.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (draggedId && draggedId !== episode.id) {
                      e.preventDefault()
                      setDragOverId(episode.id)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverId === episode.id) setDragOverId(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggedId && draggedId !== episode.id && onReorderEpisodes) {
                      onReorderEpisodes(draggedId, episode.id)
                    }
                    setDraggedId(null)
                    setDragOverId(null)
                  }}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDragOverId(null)
                  }}
                  className={`flex items-center gap-1 p-2 rounded cursor-pointer transition-colors group ${
                    selectedEpisode === episode.id
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                  onClick={() => {
                    // 单击：选中 + 跳转到正文中该剧集对应位置
                    // 之前是双击才跳，体验割裂；现在和 treeData 模式行为一致
                    onSelectEpisode(episode.id)
                    onJumpToEpisode?.(episode.id)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, { kind: 'episode', episode })}
                >
                  {/* 展开/折叠箭头：单独按钮，避免和跳转冲突 */}
                  <button
                    className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleEpisode(episode.id)
                    }}
                    aria-label={expandedEpisodes.has(episode.id) ? '折叠场景' : '展开场景'}
                  >
                    {expandedEpisodes.has(episode.id) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <FileText className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {renaming?.type === 'episode' && renaming.id === episode.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renaming.value}
                        onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                        onBlur={confirmRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename()
                          if (e.key === 'Escape') cancelRename()
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-5 px-1 rounded bg-[#252525] border border-emerald-500/50 text-sm text-white focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-white truncate">
                          第{episode.episodeNo}集
                        </span>
                        {episode.title && (
                          <span className="text-xs text-[#888] truncate">- {episode.title}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 状态标记 */}
                  {episode.status && (
                    <span className={`text-xs ${statusColors[episode.status] || 'text-gray-400'}`}>
                      ●
                    </span>
                  )}
                </div>

                {/* 场景列表 */}
                {expandedEpisodes.has(episode.id) && (
                  <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-2">
                    {episode.scenes.length === 0 ? (
                      <div className="text-xs text-[#666] py-1 px-2">暂无场景</div>
                    ) : (
                      episode.scenes.map((scene) => (
                        <div
                          key={scene.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm transition-colors ${
                            selectedScene === scene.id
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-white/5 text-gray-400'
                          }`}
                          onClick={() => {
                            // 单击：选中 + 跳转到正文中该场景对应位置
                            onSelectScene(scene.id)
                            onJumpToScene?.(scene.id)
                          }}
                          onContextMenu={(e) => handleContextMenu(e, { kind: 'scene', scene, episodeId: episode.id })}
                        >
                          <span className="text-gray-500 text-xs">景</span>
                          {renaming?.type === 'scene' && renaming.id === scene.id ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onBlur={confirmRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename()
                                if (e.key === 'Escape') cancelRename()
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 h-5 px-1 rounded bg-[#252525] border border-emerald-500/50 text-xs text-white focus:outline-none"
                            />
                          ) : (
                            <span className="text-xs truncate">
                              {scene.location || '未命名'} · {scene.time || ''}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                    <button
                      className="w-full text-left px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                      onClick={() => onAddScene(episode.id)}
                    >
                      <Plus className="h-3 w-3" />
                      添加场景
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右键菜单 - 需求文档 Feature 1.5: 新建、删除、重命名、复制 */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[140px] py-1 bg-[#252525] border border-white/10 rounded-md shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* 新建 */}
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
            onClick={() => {
              const item = contextMenu.item
              if (item.kind === 'episode') {
                // 新建同级剧集
                onAddEpisode()
              } else {
                // 新建同级场景
                onAddScene(item.episodeId)
              }
              setContextMenu(null)
            }}
          >
            <Plus className="h-3 w-3" />
            新建
          </button>
          {/* 重命名 */}
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
            onClick={() => {
              if (contextMenu.item.kind === 'episode') {
                startRenameEpisode(contextMenu.item.episode)
              } else {
                startRenameScene(contextMenu.item.scene)
              }
            }}
          >
            <Edit2 className="h-3 w-3" />
            重命名
          </button>
          {/* 复制 */}
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
            onClick={handleDuplicate}
          >
            <Copy className="h-3 w-3" />
            复制
          </button>
          {/* 删除 */}
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
            删除
          </button>
        </div>
      )}
    </div>
  )
}
