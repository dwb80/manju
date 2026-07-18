'use client'

/**
 * @file TagManager.tsx
 * @description 标签管理组件，支持标签的添加、删除、搜索和选择功能
 */

import { useState, useEffect } from 'react'
import {
  Tag,
  Plus,
  X,
  Search,
  Filter,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { scriptCenterService } from '@/services/script-center.service'

interface TagItem {
  id: string
  name: string
  color: string
  count?: number
}

interface TagManagerProps {
  scriptId: string
  onTagSelect?: (tagId: string) => void
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

/**
 * TagManager - 标签管理组件
 * @param {TagManagerProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @param {Function} [props.onTagSelect] - 选择标签回调
 * @returns {JSX.Element} 渲染的标签管理界面
 */
export function TagManager({ scriptId, onTagSelect }: TagManagerProps) {
  const [tags, setTags] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    loadTags()
  }, [scriptId])

  const loadTags = async () => {
    try {
      const result = await scriptCenterService.getTags(scriptId)
      setTags(result)
    } catch (error) {
      console.error('Failed to load tags:', error)
      setTags([])
    } finally {
      setLoading(false)
    }
  }

  const addTag = async () => {
    if (!newTagName.trim()) return

    try {
      await scriptCenterService.addTag(scriptId, {
        name: newTagName.trim(),
        color: newTagColor,
      })
      await loadTags()
      setShowAddDialog(false)
      setNewTagName('')
      setNewTagColor(PRESET_COLORS[0])
    } catch (error) {
      console.error('Failed to add tag:', error)
    }
  }

  const removeTag = async (tagId: string) => {
    try {
      await scriptCenterService.removeTag(scriptId, tagId)
      await loadTags()
      setSelectedTags(selectedTags.filter((id) => id !== tagId))
    } catch (error) {
      console.error('Failed to remove tag:', error)
    }
  }

  const toggleTagSelection = (tagId: string) => {
    if (onTagSelect) {
      onTagSelect(tagId)
    }
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="tag-manager bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="tag-manager bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">标签管理</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          添加标签
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* 标签列表 */}
      <div className="p-3">
        {filteredTags.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的标签' : '暂无标签'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="mt-2"
              >
                添加第一个标签
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedTags.includes(tag.id)
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : 'bg-white/5 hover:bg-white/10'
                  }`}
                onClick={() => toggleTagSelection(tag.id)}
              >
                {/* 标签颜色 */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />

                {/* 标签名称 */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white truncate">{tag.name}</span>
                </div>

                {/* 使用次数 */}
                {tag.count !== undefined && (
                  <span className="text-xs text-[#888]">{tag.count}</span>
                )}

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTag(tag.id)
                  }}
                  className="h-6 w-6 p-0 opacity-0 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 标签统计 */}
      {tags.length > 0 && (
        <div className="p-3 border-t border-white/10 bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-[#888]" />
            <span className="text-xs text-[#888]">标签统计</span>
          </div>
          <div className="text-sm text-white">
            共 {tags.length} 个标签，已选中 {selectedTags.length} 个
          </div>
        </div>
      )}

      {/* 添加标签对话框 */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 w-[320px]">
            <div className="text-sm font-medium text-white mb-3">添加新标签</div>
            <div className="space-y-3">
              <Input
                placeholder="标签名称"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8 text-sm"
              />
              <div>
                <div className="text-xs text-[#888] mb-2">选择颜色</div>
                <div className="grid grid-cols-8 gap-1">
                  {PRESET_COLORS.map((color) => (
                    <div
                      key={color}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${newTagColor === color ? 'scale-1.2 ring-2 ring-white/50' : ''
                        }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddDialog(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={addTag}
                  disabled={!newTagName.trim()}
                  className="flex-1"
                >
                  添加
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}