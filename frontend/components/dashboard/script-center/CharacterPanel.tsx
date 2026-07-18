'use client'

/**
 * CharacterPanel —— 角色资产面板（v3）
 *
 * 与角色工厂联动：
 * - 顶部"+ 添加"按钮 → 父组件回调（通常会 window.open 角色工厂）
 * - 每张卡片悬浮显示 👁 详情按钮 + 🗑 删除按钮
 * - 缩略图区域展示 image（来自工厂）；缺失时显示色块 + 名称首字
 *
 * v3 扩展展示字段（与后端 Character 实体对齐）：
 *   - identity（身份）  - age/gender  - temperament（气质）
 *   - costume_name + costume_color（服装）
 *   - accessories（配饰）
 *   - usage_count（引用次数） + version（工厂版本号）
 *   - confidence（推断可信度：confirmed / inferred）
 */

import { useState } from 'react'
import { User, Plus, Search, Trash2, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CharacterDetailModal, type CharacterDetailMerged } from './modals/CharacterDetailModal'
import { truncateDesc } from '@/lib/text-utils'

interface CharacterAsset {
  id: string
  name: string
  assetId?: string
  description?: string
  color: string
  thumbnail?: string
  image?: string
  role?: string
  gender?: string
  age?: number
  appearance?: string
  personality?: string
  traits?: string[]
  tags?: string[]
  // v3 扩展字段
  identity?: string
  face?: string
  hair?: string
  body?: string
  temperament?: string
  costume_name?: string
  costume_description?: string
  costume_color?: string
  costume_material?: string
  costume_style?: string
  accessories?: string[]
  emotion_states?: string
  action_assets?: string
  relationships?: string
  first_appearance?: string
  dialogue_count?: number
  generation_prompt?: string
  confidence?: string
  usage_count?: number
  version?: number
}

interface CharacterPanelProps {
  characters: CharacterAsset[]
  onAddCharacter: () => void
  onSelectCharacter: (character: CharacterAsset) => void
  onEditCharacter?: (character: CharacterAsset) => void
  onDeleteCharacter: (id: string) => void
  /**
   * 可选：点击"眼睛"按钮打开详情弹框时由父组件注入的回调。
   * 返回 Promise；resolve 后 CharacterPanel 关闭弹框、resolve(false) 保持打开。
   * 父组件负责调用工厂 API + 刷 store。
   */
  onViewCharacterDetail?: (
    character: CharacterAsset,
  ) => Promise<{ onSaveAsAsset: (merged: CharacterDetailMerged) => Promise<void> | void; onSyncToFactory?: (merged: CharacterDetailMerged) => Promise<void> | void; projectId: string; scriptId?: string; analyzePreviewCharacter?: any | null } | null>
  /**
   * 可选：父组件传入的当前项目 ID，传给详情弹框
   */
  projectId?: string
  /**
   * 可选：父组件传入的当前剧本 ID，传给详情弹框
   */
  scriptId?: string
}

/** 角色身份 → 中文标签 */
const ROLE_LABELS: Record<string, string> = {
  protagonist: '主角',
  supporting: '配角',
  antagonist: '反派',
  minor: '龙套',
}

/** 性别 → 中文标签 */
const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
}

export function CharacterPanel({
  characters,
  onAddCharacter,
  onSelectCharacter,
  onDeleteCharacter,
  onViewCharacterDetail,
  projectId,
  scriptId,
}: CharacterPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  // 详情弹框：当前选中的角色
  const [detailCharacter, setDetailCharacter] = useState<CharacterAsset | null>(null)
  // 详情弹框所需上下文（懒加载，仅打开时请求一次）
  const [detailContext, setDetailContext] = useState<{
    onSaveAsAsset: (merged: CharacterDetailMerged) => Promise<void> | void
    onSyncToFactory?: (merged: CharacterDetailMerged) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewCharacter?: any | null
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 搜索：按 name 优先匹配，然后 identity / description / tags 模糊匹配
  // - 名称匹配的卡片排在前面，标"名称"角标
  // - 仅在 description / tags 命中的卡片标"描述"角标
  const loweredQ = searchQuery.toLowerCase()
  const filteredCharacters = !loweredQ
    ? characters
    : characters
        .map((char) => {
          const nameHit = !!char.name?.toLowerCase().includes(loweredQ)
          const identityHit = !!char.identity?.toLowerCase().includes(loweredQ)
          const descriptionHit = !!char.description?.toLowerCase().includes(loweredQ)
          const tagHit = !!char.tags?.some((t) => t.toLowerCase().includes(loweredQ))
          const matchKind: 'name' | 'desc' | null = nameHit
            ? 'name'
            : identityHit || descriptionHit || tagHit
              ? 'desc'
              : null
          return { char, matchKind }
        })
        .filter((x) => x.matchKind !== null)
        .sort((a, b) => {
          // name 优先，再按原顺序
          if (a.matchKind === b.matchKind) return 0
          return a.matchKind === 'name' ? -1 : 1
        })
        .map((x) => x.char)

  /**
   * 打开角色详情弹框
   * - 若父组件传了 onViewCharacterDetail，则异步请求一次上下文（避免每次打开都请求）
   * - 否则只显示 store 中的基础信息（保存按钮也禁用）
   */
  const handleViewDetail = async (char: CharacterAsset) => {
    setDetailCharacter(char)
    setDetailContext(null)
    if (!onViewCharacterDetail) return
    if (!projectId) {
      // 没有项目 ID 也允许打开，但保存按钮会禁用
      return
    }
    setDetailLoading(true)
    try {
      const ctx = await onViewCharacterDetail(char)
      if (ctx) setDetailContext(ctx)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailCharacter(null)
    setDetailContext(null)
    setDetailLoading(false)
  }

  return (
    <div className="character-panel bg-[#1a1a1a] h-full overflow-y-auto">
      {/* 标题和搜索 */}
      <div className="p-3 border-b border-white/10 sticky top-0 bg-[#1a1a1a] z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
            <span className="text-cyan-400">●</span>
            角色资产
            <span className="text-[10px] text-[#666]">· {characters.length} · 来自剧本中心</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCharacter}
            className="h-6 text-[10px] px-1.5"
            title="在角色工厂中添加（新标签页）"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            添加
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索角色名 / 身份 / 标签..."
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
                <ExternalLink className="h-3 w-3 mr-1" />
                在角色工厂中添加
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredCharacters.map((character) => {
              // 计算当前卡片在搜索时匹配的方式（name 优先，desc 次之）
              const matchKind: 'name' | 'desc' | null = !loweredQ
                ? null
                : (character.name?.toLowerCase().includes(loweredQ))
                  ? 'name'
                  : (character.identity?.toLowerCase().includes(loweredQ) ||
                      character.description?.toLowerCase().includes(loweredQ) ||
                      character.tags?.some((t) => t.toLowerCase().includes(loweredQ)))
                    ? 'desc'
                    : null
              return (
              <div
                key={character.id}
                className="group relative flex items-start gap-3 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
              >
                {/* 缩略图（点击打开详情）—— 3:4 立幅 */}
                <div
                  className="w-12 h-16 rounded flex items-center justify-center text-white font-medium cursor-pointer flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: character.color }}
                  onClick={() => handleViewDetail(character)}
                  title="点击查看角色详情"
                >
                  {character.image || character.thumbnail ? (
                    <img
                      src={character.image || character.thumbnail}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </div>

                {/* 信息 */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectCharacter(character)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-white text-sm truncate">
                      {character.name || '未命名'}
                    </span>
                    {/* 搜索匹配方式指示器（仅搜索时显示） */}
                    {matchKind === 'name' && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        title="按名称匹配"
                      >
                        名称
                      </span>
                    )}
                    {matchKind === 'desc' && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        title="按身份/描述/标签匹配"
                      >
                        描述
                      </span>
                    )}
                    {/* 身份徽章 */}
                    {character.identity && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                        {character.identity}
                      </span>
                    )}
                    {/* 角色类别 */}
                    {character.role && ROLE_LABELS[character.role] && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20">
                        {ROLE_LABELS[character.role]}
                      </span>
                    )}
                    {/* AI 推断可信度 */}
                    {character.confidence && (
                      <span
                        className={
                          'text-[9px] px-1 py-0.5 rounded ' +
                          (character.confidence === 'confirmed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400')
                        }
                        title="AI 推断可信度"
                      >
                        {character.confidence === 'confirmed' ? '已确认' : '推断'}
                      </span>
                    )}
                  </div>

                  {/* 基础属性行：性别 / 年龄 / 气质 */}
                  {(character.gender || character.age != null || character.temperament) && (
                    <div className="text-[10px] text-[#888] mt-1 flex items-center gap-2 flex-wrap">
                      {character.gender && GENDER_LABELS[character.gender] && (
                        <span>{GENDER_LABELS[character.gender]}</span>
                      )}
                      {character.age != null && <span>{character.age}岁</span>}
                      {character.temperament && (
                        <span className="text-[#aaa]">· {character.temperament}</span>
                      )}
                    </div>
                  )}

                  {/* 服装信息 */}
                  {character.costume_name && (
                    <div className="text-[10px] text-[#888] mt-0.5 truncate">
                      <span className="text-amber-400/80">服装:</span>{' '}
                      {character.costume_color && (
                        <span
                          className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                          style={{
                            backgroundColor: character.costume_color,
                            border: '1px solid rgba(255,255,255,0.2)',
                          }}
                        />
                      )}
                      {character.costume_name}
                      {character.costume_material && ` · ${character.costume_material}`}
                    </div>
                  )}

                  {/* 描述（最多 12 字 + ...） */}
                  {character.description && (
                    <div
                      className="text-xs text-[#888] truncate mt-1"
                      title={character.description}
                    >
                      {truncateDesc(character.description)}
                    </div>
                  )}

                  {/* 标签 */}
                  {character.tags && character.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {character.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-[#999]"
                        >
                          {tag}
                        </span>
                      ))}
                      {character.tags.length > 3 && (
                        <span className="text-[9px] text-[#666]">+{character.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* 工厂元数据：引用次数 + 版本号 */}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-[#666]">
                    {character.usage_count != null && (
                      <span className="text-purple-400/80">引用 {character.usage_count} 次</span>
                    )}
                    {character.version != null && (
                      <span className="px-1 rounded bg-white/5">v{character.version}</span>
                    )}
                    {character.assetId && (
                      <span className="text-emerald-400/70">● 工厂同步</span>
                    )}
                  </div>
                </div>

                {/* 操作按钮（悬浮显示） */}
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a1a]/80 backdrop-blur-sm rounded px-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetail(character)}
                    className="h-6 w-6 p-0"
                    title="查看 AI 解析详情"
                    aria-label="查看详情"
                  >
                    <Eye className="h-3 w-3 text-cyan-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteCharacter(character.id)}
                    className="h-6 w-6 p-0"
                    title="从剧本移除（不会删除工厂资产）"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* === 角色详情弹框 === */}
      {detailCharacter && (
        <CharacterDetailModal
          character={{
            id: detailCharacter.id,
            name: detailCharacter.name,
            description: detailCharacter.description,
            color: detailCharacter.color,
            image: detailCharacter.image,
            role: detailCharacter.role,
            gender: detailCharacter.gender,
            age: detailCharacter.age,
            appearance: detailCharacter.appearance,
            personality: detailCharacter.personality,
            traits: detailCharacter.traits,
            tags: detailCharacter.tags,
          }}
          analyzePreviewCharacter={detailContext?.analyzePreviewCharacter ?? null}
          onClose={closeDetail}
          onSaveAsAsset={async (merged) => {
            if (!detailContext) {
              throw new Error('未连接角色工厂，请刷新页面后重试')
            }
            await detailContext.onSaveAsAsset(merged)
            closeDetail()
          }}
          onSyncToFactory={detailContext?.onSyncToFactory}
          projectId={detailContext?.projectId || projectId || ''}
          scriptId={detailContext?.scriptId || scriptId}
        />
      )}

      {/* 详情上下文加载提示 */}
      {detailLoading && detailCharacter && (
        <div className="fixed top-4 right-4 z-[60] px-3 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs rounded">
          正在加载 AI 解析上下文…
        </div>
      )}
    </div>
  )
}
