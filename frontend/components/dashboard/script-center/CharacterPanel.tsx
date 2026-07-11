'use client'

import { useState } from 'react'
import { User, Plus, Search, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CharacterAsset {
  id: string
  name: string
  assetId?: string
  description?: string  // 改为可选
  color: string
  thumbnail?: string
}

interface CharacterPanelProps {
  characters: CharacterAsset[]
  onAddCharacter: () => void
  onSelectCharacter: (character: CharacterAsset) => void
  onDeleteCharacter: (id: string) => void
}

export function CharacterPanel({
  characters,
  onAddCharacter,
  onSelectCharacter,
  onDeleteCharacter,
}: CharacterPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCharacters = characters.filter((char) =>
    char.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="character-panel bg-[#1a1a1a] border-l border-white/10 h-full overflow-y-auto">
      {/* 标题和搜索 */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">角色资产</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCharacter}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索角色..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* 角色列表 */}
      <div className="p-2">
        {filteredCharacters.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的角色' : '暂无角色资产'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddCharacter}
                className="mt-2"
              >
                添加角色
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                className="group flex items-start gap-3 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => onSelectCharacter(character)}
              >
                {/* 缩略图 */}
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: character.color }}
                >
                  {character.thumbnail ? (
                    <img
                      src={character.thumbnail}
                      alt={character.name}
                      className="w-full h-full rounded object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">
                    {character.name}
                  </div>
                  {character.description && (
                    <div className="text-xs text-[#888] truncate mt-1">
                      {character.description}
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteCharacter(character.id)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}