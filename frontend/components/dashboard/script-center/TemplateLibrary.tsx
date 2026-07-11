'use client'

import { useState, useEffect } from 'react'
import {
  BookOpen,
  Eye,
  Plus,
  Star,
  MessageSquare,
  Search,
  Grid,
  List,
  ChevronRight,
  X,
  Clock,
  User,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Template {
  id: string
  name: string
  category: 'ancient' | 'modern' | 'scifi' | 'fantasy' | 'romance' | 'action' | 'comedy'
  description: string
  preview: string
  rating: number
  reviews: number
  author: string
  downloads: number
  tags: string[]
  features: string[]
  structure: string[]
}

interface TemplateLibraryProps {
  onSelectTemplate?: (template: Template) => void
  onCreateFromTemplate?: (template: Template | string) => Promise<void>
}

export function TemplateLibrary({
  onSelectTemplate,
  onCreateFromTemplate,
}: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewingTemplate, setPreviewingTemplate] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      // 模拟加载模板数据
      await new Promise((resolve) => setTimeout(resolve, 500))

      setTemplates([
        {
          id: 'template-1',
          name: '古装宫廷剧模板',
          category: 'ancient',
          description: '经典宫廷剧剧本结构，包含宫廷争斗、爱情纠葛、权谋博弈等元素',
          preview: '第一幕：入宫 - 新角色进入宫廷...\n第二幕：争斗 - 各种阴谋与斗争...',
          rating: 4.8,
          reviews: 156,
          author: '编剧大师',
          downloads: 2341,
          tags: ['宫廷', '古装', '爱情', '权谋'],
          features: ['经典三幕结构', '多角色线索', '情感冲突设置', '权力斗争框架'],
          structure: ['入宫', '争斗', '高潮', '结局'],
        },
        {
          id: 'template-2',
          name: '现代都市剧模板',
          category: 'modern',
          description: '现代都市背景下的剧本结构，涵盖职场、家庭、友情、爱情等主题',
          preview: '开篇：职场困境 - 主角面临职业挑战...\n发展：人际关系 - 与同事、朋友的关系...',
          rating: 4.5,
          reviews: 89,
          author: '都市编剧',
          downloads: 1567,
          tags: ['都市', '现代', '职场', '家庭'],
          features: ['现代背景设定', '职场叙事', '家庭关系', '都市生活'],
          structure: ['困境', '奋斗', '转折', '成长'],
        },
        {
          id: 'template-3',
          name: '科幻冒险剧模板',
          category: 'scifi',
          description: '科幻背景的剧本结构，包含科技设定、冒险旅程、未来世界等元素',
          preview: '序幕：未来世界 - 设定科技背景...\n第一幕：危机 - 面临重大挑战...',
          rating: 4.9,
          reviews: 203,
          author: '科幻作家',
          downloads: 3254,
          tags: ['科幻', '冒险', '未来', '科技'],
          features: ['未来世界设定', '科技元素', '冒险叙事', '想象空间'],
          structure: ['设定', '危机', '探索', '突破'],
        },
        {
          id: 'template-4',
          name: '奇幻魔幻剧模板',
          category: 'fantasy',
          description: '奇幻世界的剧本结构，包含魔法设定、异世界探索、传奇冒险等',
          preview: '开篇：魔法世界 - 奇幻设定介绍...\n发展：成长之路 - 角色成长...',
          rating: 4.7,
          reviews: 124,
          author: '奇幻大师',
          downloads: 2789,
          tags: ['奇幻', '魔法', '冒险', '成长'],
          features: ['魔法系统', '异世界设定', '成长叙事', '奇幻元素'],
          structure: ['觉醒', '修炼', '战斗', '传奇'],
        },
        {
          id: 'template-5',
          name: '爱情偶像剧模板',
          category: 'romance',
          description: '爱情剧的经典结构，包含相遇、追求、误会、和解等情节',
          preview: '第一集：相遇 - 奇妙的相遇...\n发展：追求 - 爱情的发展...',
          rating: 4.6,
          reviews: 178,
          author: '爱情编剧',
          downloads: 4123,
          tags: ['爱情', '偶像', '浪漫', '青春'],
          features: ['浪漫情节', '情感冲突', '青春元素', '偶像风格'],
          structure: ['相遇', '追求', '误会', '和解'],
        },
        {
          id: 'template-6',
          name: '动作冒险剧模板',
          category: 'action',
          description: '动作片剧本结构，包含追逐、战斗、冒险、拯救等情节',
          preview: '序幕：危机 - 紧急情况...\n第一幕：行动 - 开始行动...',
          rating: 4.4,
          reviews: 67,
          author: '动作编剧',
          downloads: 1456,
          tags: ['动作', '冒险', '战斗', '拯救'],
          features: ['动作场面', '紧张节奏', '冒险情节', '英雄叙事'],
          structure: ['危机', '行动', '战斗', '胜利'],
        },
        {
          id: 'template-7',
          name: '喜剧搞笑剧模板',
          category: 'comedy',
          description: '喜剧剧本结构，包含搞笑情节、误会喜剧、反讽幽默等元素',
          preview: '开场：误会 - 奇怪的误会...\n发展：搞笑 - 各种搞笑情节...',
          rating: 4.3,
          reviews: 92,
          author: '喜剧编剧',
          downloads: 2345,
          tags: ['喜剧', '搞笑', '幽默', '轻松'],
          features: ['搞笑情节', '误会喜剧', '反讽幽默', '轻松氛围'],
          structure: ['误会', '搞笑', '反转', '和解'],
        },
      ])
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFromTemplate = async (template: Template) => {
    setCreating(true)
    try {
      if (onCreateFromTemplate) {
        await onCreateFromTemplate(template)
      }
      setPreviewingTemplate(null)
    } catch (error) {
      console.error('Failed to create from template:', error)
      alert('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      ancient: '古装',
      modern: '现代',
      scifi: '科幻',
      fantasy: '奇幻',
      romance: '爱情',
      action: '动作',
      comedy: '喜剧',
    }
    return labels[category] || category
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      ancient: '🏯',
      modern: '🏢',
      scifi: '🚀',
      fantasy: '🧙',
      romance: '💕',
      action: '⚡',
      comedy: '😄',
    }
    return icons[category] || '📝'
  }

  const categories = [
    { id: 'all', label: '全部', icon: '📚' },
    { id: 'ancient', label: '古装', icon: '🏯' },
    { id: 'modern', label: '现代', icon: '🏢' },
    { id: 'scifi', label: '科幻', icon: '🚀' },
    { id: 'fantasy', label: '奇幻', icon: '🧙' },
    { id: 'romance', label: '爱情', icon: '💕' },
    { id: 'action', label: '动作', icon: '⚡' },
    { id: 'comedy', label: '喜剧', icon: '😄' },
  ]

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="template-library bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载模板库...</div>
      </div>
    )
  }

  return (
    <div className="template-library bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">剧本模板库</h3>
          <span className="text-xs text-[#666]">({templates.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded ${
              viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-[#888]'
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-[#888]'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 搜索和分类 */}
      <div className="p-3 border-b border-white/10 space-y-3">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模板..."
            className="w-full bg-white/5 border border-white/10 rounded pl-9 pr-3 py-2 text-sm text-white placeholder-[#666]"
          />
        </div>

        {/* 分类标签 */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                selectedCategory === category.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-white/5 text-[#888] border border-white/10 hover:bg-white/10'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 模板列表 */}
      <div className="p-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            未找到匹配的模板
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="border border-white/10 rounded overflow-hidden hover:border-white/20 transition-colors"
              >
                {/* 分类图标 */}
                <div className="p-3 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCategoryIcon(template.category)}</span>
                    <div>
                      <div className="text-sm font-medium text-white">{template.name}</div>
                      <div className="text-xs text-[#888]">{getCategoryLabel(template.category)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-white">{template.rating}</span>
                  </div>
                </div>

                {/* 描述 */}
                <div className="p-2">
                  <div className="text-xs text-[#888] line-clamp-2">{template.description}</div>
                </div>

                {/* 标签 */}
                <div className="px-2 pb-2 flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-[#888]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 统计 */}
                <div className="px-2 pb-2 flex items-center gap-2 text-xs text-[#666]">
                  <MessageSquare className="h-3 w-3" />
                  <span>{template.reviews} 评论</span>
                  <Clock className="h-3 w-3 ml-2" />
                  <span>{template.downloads} 下载</span>
                </div>

                {/* 操作按钮 */}
                <div className="p-2 border-t border-white/5 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewingTemplate(template)}
                    className="flex-1 h-7"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    预览
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCreateFromTemplate(template)}
                    disabled={creating}
                    className="flex-1 h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    使用
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="p-3 border border-white/10 rounded hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getCategoryIcon(template.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-white">{template.name}</div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white">{template.rating}</span>
                      </div>
                    </div>
                    <div className="text-xs text-[#888] mb-2">{template.description}</div>
                    <div className="flex items-center gap-2 text-xs text-[#666]">
                      <span>{getCategoryLabel(template.category)}</span>
                      <span>•</span>
                      <span>{template.reviews} 评论</span>
                      <span>•</span>
                      <span>{template.downloads} 下载</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewingTemplate(template)}
                      className="h-7"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      预览
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={creating}
                      className="h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      使用
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 预览对话框 */}
      {previewingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg border border-white/10 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* 标题 */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getCategoryIcon(previewingTemplate.category)}</span>
                <div>
                  <div className="text-sm font-medium text-white">
                    {previewingTemplate.name}
                  </div>
                  <div className="text-xs text-[#888]">
                    {getCategoryLabel(previewingTemplate.category)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewingTemplate(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* 评分和统计 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-bold text-white">
                    {previewingTemplate.rating}
                  </span>
                  <span className="text-xs text-[#888]">
                    ({previewingTemplate.reviews} 评论)
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#888]">
                  <User className="h-3 w-3" />
                  <span>{previewingTemplate.author}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#888]">
                  <Clock className="h-3 w-3" />
                  <span>{previewingTemplate.downloads} 下载</span>
                </div>
              </div>

              {/* 描述 */}
              <div className="mb-4">
                <div className="text-xs text-[#888] mb-1">描述</div>
                <div className="text-sm text-white">{previewingTemplate.description}</div>
              </div>

              {/* 标签 */}
              <div className="mb-4">
                <div className="text-xs text-[#888] mb-1">标签</div>
                <div className="flex flex-wrap gap-2">
                  {previewingTemplate.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded bg-white/5 text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 特性 */}
              <div className="mb-4">
                <div className="text-xs text-[#888] mb-1">模板特性</div>
                <ul className="text-sm text-white space-y-1">
                  {previewingTemplate.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 结构 */}
              <div className="mb-4">
                <div className="text-xs text-[#888] mb-1">剧本结构</div>
                <div className="flex items-center gap-2">
                  {previewingTemplate.structure.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                        {i + 1}. {step}
                      </div>
                      {i < previewingTemplate.structure.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-[#888]" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 预览内容 */}
              <div className="mb-4">
                <div className="text-xs text-[#888] mb-1">内容预览</div>
                <div className="p-3 bg-white/5 rounded border border-white/10 text-xs text-white whitespace-pre-wrap">
                  {previewingTemplate.preview}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="p-3 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs text-[#888]">点击"使用此模板"创建新剧本</div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewingTemplate(null)}
                  className="h-7"
                >
                  关闭
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleCreateFromTemplate(previewingTemplate)}
                  disabled={creating}
                  className="h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {creating ? '创建中...' : '使用此模板'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}