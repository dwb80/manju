'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Sparkles,
  MessageSquare,
  User,
  Film,
  Image as ImageIcon,
  Video,
  Wand2,
  PenLine,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { scriptCenterService } from '@/services/script-center.service'
import { toast } from '@/components/common/toast'
import { cn } from '@/lib/utils'

interface SlashCommandMenuProps {
  editor: Editor | null
}

interface CommandContext {
  editor: any
  slashRange: { from: number; to: number }
}

interface SlashCommand {
  id: string
  label: string
  description: string
  icon: LucideIcon
  keywords: string[]
  action: (ctx: CommandContext) => Promise<void> | void
}

// Insert AI-returned content which may be a string, array of nodes, or a doc object.
function insertAIContent(editor: any, content: any) {
  if (!content) return
  if (typeof content === 'string') {
    const lines = content.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return
    const nodes = lines.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }))
    editor.chain().focus().insertContent(nodes).run()
  } else if (Array.isArray(content)) {
    editor.chain().focus().insertContent(content).run()
  } else if (content.type === 'doc' && Array.isArray(content.content)) {
    editor.chain().focus().insertContent(content.content).run()
  } else {
    editor.chain().focus().insertContent(content).run()
  }
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'generate-scene',
    label: '生成Scene',
    description: 'AI 自动生成场景描述',
    icon: Sparkles,
    keywords: ['scene', '场景', '生成场景'],
    action: async (ctx) => {
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      try {
        const result = await scriptCenterService.generateScene({ location: '默认地点', time: '日' })
        if (result.description) {
          insertAIContent(ctx.editor, result.description)
        }
        toast.success('场景生成完成')
      } catch {
        toast.error('生成场景失败')
      }
    },
  },
  {
    id: 'generate-dialogue',
    label: '生成对白',
    description: 'AI 自动生成角色对话',
    icon: MessageSquare,
    keywords: ['dialogue', '对白', '对话', '生成对白'],
    action: async (ctx) => {
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      try {
        const result = await scriptCenterService.generateDialogue({ character: '主角', emotion: '平静' })
        if (result.dialogue) {
          insertAIContent(ctx.editor, result.dialogue)
        }
        toast.success('对白生成完成')
      } catch {
        toast.error('生成对白失败')
      }
    },
  },
  {
    id: 'generate-character',
    label: '生成角色',
    description: '插入角色节点',
    icon: User,
    keywords: ['character', '角色', '生成角色'],
    action: (ctx) => {
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      ctx.editor
        .chain()
        .focus()
        .insertContent({
          type: 'character',
          attrs: { name: '新角色' },
          content: [{ type: 'text', text: '新角色' }],
        })
        .run()
      toast.success('已插入角色节点')
    },
  },
  {
    id: 'split-storyboard',
    label: '生成分镜',
    description: 'AI 自动拆分镜头',
    icon: Film,
    keywords: ['storyboard', '分镜', '生成分镜'],
    action: async (ctx) => {
      const { $from } = ctx.editor.state.selection
      const contextText = $from.parent.textContent.replace(/(^|\s)\/([^\s/]*)$/, '').trim()
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      try {
        const result = await scriptCenterService.splitStoryboard({ content: contextText })
        if (result.storyboards && result.storyboards.length) {
          const nodes = result.storyboards.map((sb: any, idx: number) => ({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `分镜 ${idx + 1}: ${
                  typeof sb === 'string' ? sb : sb.description || sb.summary || JSON.stringify(sb)
                }`,
              },
            ],
          }))
          ctx.editor.chain().focus().insertContent(nodes).run()
        }
        toast.success('分镜拆分完成')
      } catch {
        toast.error('生成分镜失败')
      }
    },
  },
  {
    id: 'insert-image',
    label: '插入图片',
    description: '插入参考图片 URL',
    icon: ImageIcon,
    keywords: ['image', '图片', '插入图片'],
    action: (ctx) => {
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      const url = window.prompt('请输入图片 URL')
      if (!url) return
      ctx.editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: `📷 图片: ${url}` }],
        })
        .run()
      toast.success('已插入图片链接')
    },
  },
  {
    id: 'insert-video',
    label: '插入视频',
    description: '插入预览视频 URL',
    icon: Video,
    keywords: ['video', '视频', '插入视频'],
    action: (ctx) => {
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      const url = window.prompt('请输入视频 URL')
      if (!url) return
      ctx.editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: `🎬 视频: ${url}` }],
        })
        .run()
      toast.success('已插入视频链接')
    },
  },
  {
    id: 'ai-optimize',
    label: 'AI优化',
    description: 'AI 优化当前段落',
    icon: Wand2,
    keywords: ['optimize', '优化', 'ai优化'],
    action: async (ctx) => {
      const { $from } = ctx.editor.state.selection
      const contextText = $from.parent.textContent.replace(/(^|\s)\/([^\s/]*)$/, '').trim()
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      try {
        const result = await scriptCenterService.optimizeScript({
          content: contextText,
          optimization_type: 'grammar',
        })
        if (result.optimizedContent) {
          insertAIContent(ctx.editor, result.optimizedContent)
        }
        toast.success('优化完成')
      } catch {
        toast.error('优化失败')
      }
    },
  },
  {
    id: 'ai-expand',
    label: 'AI扩写',
    description: 'AI 扩写当前段落',
    icon: PenLine,
    keywords: ['expand', '扩写', 'ai扩写'],
    action: async (ctx) => {
      const { $from } = ctx.editor.state.selection
      const contextText = $from.parent.textContent.replace(/(^|\s)\/([^\s/]*)$/, '').trim()
      ctx.editor.chain().focus().deleteRange(ctx.slashRange).run()
      try {
        const result = await scriptCenterService.generateScript({
          prompt: contextText || '请扩写一段剧本内容',
          style: 'detailed',
        })
        if (result.content) {
          insertAIContent(ctx.editor, result.content)
        }
        toast.success('扩写完成')
      } catch {
        toast.error('扩写失败')
      }
    },
  },
]

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const slashRangeRef = useRef<{ from: number; to: number } | null>(null)
  const isExecutingRef = useRef(false)
  const isOpenRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // keep isOpenRef in sync so the transaction listener can read latest value
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return COMMANDS
    return COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.toLowerCase().includes(q))
    )
  }, [query])

  // reset selection whenever the filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
    setCoords(null)
    slashRangeRef.current = null
  }, [])

  // Listen to editor transactions to detect the slash command input
  useEffect(() => {
    if (!editor) return
    const handleTransaction = () => {
      if (isExecutingRef.current || editor.isDestroyed) return
      const { selection } = editor.state
      if (!selection.empty) {
        if (isOpenRef.current) closeMenu()
        return
      }
      const $from = selection.$from
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
      // Match a "/" that is at the start of the line or preceded by whitespace,
      // followed by zero or more non-space/non-slash chars at the end of text.
      const match = textBefore.match(/(^|\s)(\/([^\s/]*))$/)
      if (match) {
        const prefixLen = match[1].length
        const slashIndex = (match.index ?? 0) + prefixLen
        const q = match[3]
        const slashPos = $from.start() + slashIndex
        let pos: { top: number; left: number } | null = null
        try {
          const c = editor.view.coordsAtPos(selection.from)
          pos = { top: c.bottom + 6, left: c.left }
        } catch {
          pos = null
        }
        slashRangeRef.current = { from: slashPos, to: selection.from }
        setQuery(q)
        setCoords(pos)
        setIsOpen(true)
      } else {
        if (isOpenRef.current) closeMenu()
      }
    }
    editor.on('transaction', handleTransaction)
    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor, closeMenu])

  const executeCommand = useCallback(
    async (cmd: SlashCommand) => {
      if (!editor) return
      const range = slashRangeRef.current
      if (!range) return
      isExecutingRef.current = true
      setLoadingAction(cmd.id)
      try {
        await cmd.action({ editor, slashRange: range })
      } finally {
        isExecutingRef.current = false
        setLoadingAction(null)
        closeMenu()
        if (!editor.isDestroyed) {
          editor.commands.focus()
        }
      }
    },
    [editor, closeMenu]
  )

  // Keyboard navigation while the menu is open (capture phase to intercept editor keys)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (loadingAction) {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          closeMenu()
        }
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((i) => (i + 1) % Math.max(filteredCommands.length, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(
          (i) => (i - 1 + Math.max(filteredCommands.length, 1)) % Math.max(filteredCommands.length, 1)
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const cmd = filteredCommands[selectedIndex]
        if (cmd) executeCommand(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeMenu()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [isOpen, filteredCommands, selectedIndex, loadingAction, executeCommand, closeMenu])

  // Close the menu when clicking outside of it
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, closeMenu])

  if (!editor || !isOpen || !coords) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
    >
      {loadingAction ? (
        <div className="px-3 py-3 text-sm text-gray-200 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          AI生成中...
        </div>
      ) : filteredCommands.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-500">没有匹配的命令</div>
      ) : (
        <div className="max-h-80 overflow-y-auto py-1">
          {filteredCommands.map((cmd, index) => {
            const Icon = cmd.icon
            const active = index === selectedIndex
            return (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => executeCommand(cmd)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors',
                  active ? 'bg-white/10' : 'hover:bg-white/5'
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-100">/{cmd.label}</div>
                  <div className="text-xs text-gray-500 truncate">{cmd.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
