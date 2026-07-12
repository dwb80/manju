'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Film,
  MapPin,
  User,
  GripVertical,
  Plus,
  MoreVertical,
  Edit3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OutlineNode {
  id: string
  type: 'episode' | 'scene' | 'character'
  title: string
  subtitle?: string
  children?: OutlineNode[]
  order: number
}

interface OutlineViewProps {
  nodes: OutlineNode[]
  onNodeClick: (node: OutlineNode) => void
  onNodeReorder: (nodeId: string, newOrder: number, parentId?: string) => Promise<void>
  onAddNode?: (type: 'episode' | 'scene' | 'character', parentId?: string) => void
  onNodeDelete?: (nodeId: string) => void
  onNodeRename?: (nodeId: string, newTitle: string) => void
  /** 切回编辑模式的回调；提供时会在标题栏显示"返回编辑"按钮 */
  onBackToEdit?: () => void
}

export function OutlineView({
  nodes,
  onNodeClick,
  onNodeReorder,
  onAddNode,
  onNodeDelete,
  onNodeRename,
  onBackToEdit,
}: OutlineViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [draggedNode, setDraggedNode] = useState<OutlineNode | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, node: OutlineNode) => {
    e.dataTransfer.effectAllowed = 'move'
    setDraggedNode(node)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetNode: OutlineNode) => {
      e.preventDefault()
      if (!draggedNode || draggedNode.id === targetNode.id) {
        setDraggedNode(null)
        setDropTarget(null)
        return
      }

      try {
        await onNodeReorder(draggedNode.id, targetNode.order)
      } catch (error) {
        console.error('Failed to reorder node:', error)
      } finally {
        setDraggedNode(null)
        setDropTarget(null)
      }
    },
    [draggedNode, onNodeReorder]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedNode(null)
    setDropTarget(null)
  }, [])

  const getNodeIcon = (type: 'episode' | 'scene' | 'character') => {
    switch (type) {
      case 'episode':
        return <Film className="h-4 w-4 text-emerald-400" />
      case 'scene':
        return <MapPin className="h-4 w-4 text-blue-400" />
      case 'character':
        return <User className="h-4 w-4 text-purple-400" />
    }
  }

  const renderNode = (node: OutlineNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)

    return (
      <div key={node.id} className="outline-node">
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
            dropTarget === node.id ? 'bg-emerald-500/20' : 'hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onNodeClick(node)}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={handleDragEnd}
        >
          {/* 拖拽手柄 */}
          <GripVertical className="h-3 w-3 text-[#666] cursor-move flex-shrink-0" />

          {/* 展开/折叠按钮 */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(node.id)
              }}
              className="text-[#888] hover:text-white flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}

          {/* 图标 */}
          {getNodeIcon(node.type)}

          {/* 标题 */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-white truncate">{node.title}</span>
            {node.subtitle && (
              <span className="text-xs text-[#888] ml-2 truncate">{node.subtitle}</span>
            )}
          </div>

          {/* 添加子节点按钮 */}
          {(node.type === 'episode' || node.type === 'scene') && onAddNode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                const childType = node.type === 'episode' ? 'scene' : 'character'
                onAddNode(childType, node.id)
              }}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}

          {/* 更多操作按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              // TODO: 显示操作菜单
            }}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div className="children">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="outline-view bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden h-full flex flex-col">
      {/* 标题栏 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0 gap-2">
        <h3 className="text-sm font-medium text-white">大纲视图</h3>
        <div className="flex items-center gap-1">
          {onAddNode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddNode('episode')}
                className="h-6 w-6 p-0"
                title="添加剧集"
              >
                <Film className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddNode('character')}
                className="h-6 w-6 p-0"
                title="添加角色"
              >
                <User className="h-3 w-3" />
              </Button>
            </>
          )}
          {onBackToEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={onBackToEdit}
              className="h-7 px-2 ml-1 text-xs bg-emerald-500 hover:bg-emerald-600"
              title="返回编辑器"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              返回编辑
            </Button>
          )}
        </div>
      </div>

      {/* 大纲树 */}
      <div className="flex-1 overflow-y-auto p-2">
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            暂无大纲内容
            {onAddNode && (
              <Button variant="ghost" size="sm" onClick={() => onAddNode('episode')} className="mt-2">
                添加第一集
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">{nodes.map((node) => renderNode(node))}</div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-[#888]">
          <span>
            {nodes.filter((n) => n.type === 'episode').length} 集 •{' '}
            {nodes.filter((n) => n.type === 'character').length} 角色
          </span>
          <span>
            {nodes.reduce((acc, node) => acc + (node.children?.length || 0), 0)} 场景
          </span>
        </div>
      </div>
    </div>
  )
}