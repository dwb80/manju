'use client'

import { useState } from 'react'
import { Film, Plus, Search, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SceneAsset {
  id: string
  location: string
  time: string
  description?: string  // 改为可选
  thumbnail?: string
}

interface ScenePanelProps {
  scenes: SceneAsset[]
  onAddScene: () => void
  onSelectScene: (scene: SceneAsset) => void
  onDeleteScene: (id: string) => void
}

export function ScenePanel({
  scenes,
  onAddScene,
  onSelectScene,
  onDeleteScene,
}: ScenePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredScenes = scenes.filter((scene) =>
    scene.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scene.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="scene-panel bg-[#1a1a1a] border-l border-white/10 h-full overflow-y-auto">
      {/* 标题和搜索 */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">场景资产</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddScene}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索场景..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* 场景列表 */}
      <div className="p-2">
        {filteredScenes.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的场景' : '暂无场景资产'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddScene}
                className="mt-2"
              >
                添加场景
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredScenes.map((scene) => (
              <div
                key={scene.id}
                className="group flex items-start gap-3 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => onSelectScene(scene)}
              >
                {/* 缩略图 */}
                <div className="w-10 h-10 rounded bg-[#252525] flex items-center justify-center text-[#888]">
                  {scene.thumbnail ? (
                    <img
                      src={scene.thumbnail}
                      alt={scene.location}
                      className="w-full h-full rounded object-cover"
                    />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">
                    {scene.location}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#888] mt-1">
                    <Film className="h-3 w-3" />
                    <span>{scene.time}</span>
                  </div>
                  {scene.description && (
                    <div className="text-xs text-[#666] truncate mt-1">
                      {scene.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}