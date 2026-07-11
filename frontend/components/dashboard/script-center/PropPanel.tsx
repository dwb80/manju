'use client'

import { useState } from 'react'
import { Package, Plus, Search, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PropAsset {
  id: string
  name: string
  assetId?: string
  description?: string
  category?: string
  color?: string
  thumbnail?: string
}

interface PropPanelProps {
  props: PropAsset[]
  onAddProp: () => void
  onSelectProp: (prop: PropAsset) => void
  onEditProp?: (prop: PropAsset) => void
  onDeleteProp: (id: string) => void
}

export function PropPanel({
  props: propAssets,
  onAddProp,
  onSelectProp,
  onEditProp,
  onDeleteProp,
}: PropPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProps = propAssets.filter((prop) =>
    prop.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="prop-panel bg-[#1a1a1a] border-l border-white/10 h-full overflow-y-auto">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">道具资产</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddProp}
            className="h-6 text-[10px] px-1.5"
            title="在道具工厂中添加"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            添加
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索道具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <div className="p-2">
        {filteredProps.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的道具' : '暂无道具资产'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddProp}
                className="mt-2"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                在道具工厂中添加
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredProps.map((prop) => (
              <div
                key={prop.id}
                className="group flex items-start gap-3 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-white font-medium bg-amber-500/30 cursor-pointer flex-shrink-0"
                  onClick={() => onSelectProp(prop)}
                  title="点击插入到剧本"
                >
                  {prop.thumbnail ? (
                    <img
                      src={prop.thumbnail}
                      alt={prop.name}
                      className="w-full h-full rounded object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-amber-400" />
                  )}
                </div>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectProp(prop)}
                >
                  <div className="font-medium text-white text-sm truncate">
                    {prop.name || '未命名'}
                  </div>
                  {prop.category && (
                    <div className="text-xs text-amber-400/80 mt-0.5">
                      {prop.category}
                    </div>
                  )}
                  {prop.description && (
                    <div className="text-xs text-[#888] truncate mt-1">
                      {prop.description}
                    </div>
                  )}
                  {prop.assetId && (
                    <div className="text-[10px] text-emerald-400 mt-0.5">已同步到工厂</div>
                  )}
                </div>

                {onEditProp && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditProp(prop)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    title="在道具工厂中编辑"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteProp(prop.id)
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  title="从剧本移除"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
