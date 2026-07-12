'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import CharacterCount from '@tiptap/extension-character-count'
import Focus from '@tiptap/extension-focus'
import {
  EpisodeNode,
  SceneNode,
  CharacterNode,
  DialogueNode,
  ActionNode,
  EmotionNode,
  CameraNode,
  SoundNode,
  PropNode,
  TransitionNode,
  // SlashCommand,  // 暂时注释掉
} from '@/lib/tiptap/extensions'
import { AIBubbleMenu } from './AIBubbleMenu'
import { SlashCommandMenu } from './SlashCommandMenu'
import { useCallback, useEffect } from 'react'
import { debounce } from '@/lib/utils'

// 导航树节点类型（Feature 2.10 实时同步）
export interface NavTreeNode {
  id: string
  type: 'episode' | 'scene' | 'heading'
  title: string
  episodeNo?: number
  status?: string
  location?: string
  time?: string
  children: NavTreeNode[]
}

// 标题最多30字，超出截断
function truncateTitle(title: string): string {
  if (title.length > 30) {
    return title.slice(0, 30) + '...'
  }
  return title
}

// 从节点中提取纯文本（用于 heading 标题）
function extractText(node: any): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.content)) {
    return node.content.map((child: any) => extractText(child)).join('')
  }
  return ''
}

/**
 * 解析 TipTap Document JSON 为导航树结构（Feature 2.10）
 * - episode 节点作为一级节点，递归遍历其 content 查找嵌套 scene
 * - scene 节点：若有父 episode 则挂为子节点，否则作为一级节点
 * - heading 节点：提取文本作为一级节点
 */
export function parseDocToTree(doc: any): NavTreeNode[] {
  const tree: NavTreeNode[] = []
  if (!doc || !Array.isArray(doc.content)) return tree

  let tempIndex = 0

  const walk = (node: any, parentEpisode?: NavTreeNode): void => {
    if (!node) return
    switch (node.type) {
      case 'episode': {
        const attrs = node.attrs || {}
        const id = attrs.id || `temp-episode-${tempIndex++}`
        const treeNode: NavTreeNode = {
          id,
          type: 'episode',
          title: truncateTitle(attrs.title || ''),
          episodeNo: typeof attrs.episodeNo === 'number' ? attrs.episodeNo : 1,
          status: attrs.status,
          children: [],
        }
        tree.push(treeNode)
        // 递归遍历 episode 内容，查找嵌套 scene
        if (Array.isArray(node.content)) {
          node.content.forEach((child: any) => walk(child, treeNode))
        }
        break
      }
      case 'scene': {
        const attrs = node.attrs || {}
        const id = attrs.id || `temp-scene-${tempIndex++}`
        const location = attrs.location || ''
        const time = attrs.time || ''
        const treeNode: NavTreeNode = {
          id,
          type: 'scene',
          title: truncateTitle(`${location || '未命名'}${time ? ' · ' + time : ''}`),
          location,
          time,
          children: [],
        }
        if (parentEpisode) {
          parentEpisode.children.push(treeNode)
        } else {
          tree.push(treeNode)
        }
        break
      }
      case 'heading': {
        const id = `temp-heading-${tempIndex++}`
        const text = extractText(node)
        const treeNode: NavTreeNode = {
          id,
          type: 'heading',
          title: truncateTitle(text || '未命名标题'),
          children: [],
        }
        tree.push(treeNode)
        break
      }
      default:
        // 其他块级节点：递归查找内部嵌套的 episode/scene/heading
        if (Array.isArray(node.content)) {
          node.content.forEach((child: any) => walk(child, parentEpisode))
        }
        break
    }
  }

  doc.content.forEach((node: any) => walk(node))
  return tree
}

interface ScriptEditorProps {
  document: {
    id: string
    title: string
    editor_json: any
  }
  onSave?: (content: any) => void
  onEditorReady?: (editor: any) => void
  /** 编辑器内容变化时（100ms 防抖）回调最新导航树 */
  onTreeUpdate?: (tree: NavTreeNode[]) => void
}

export function ScriptEditor({ document, onSave, onEditorReady, onTreeUpdate }: ScriptEditorProps) {
  // 自动保存逻辑（防抖）
  const handleUpdate = useCallback(
    debounce((editor: any) => {
      if (onSave) {
        const json = editor.getJSON()
        onSave(json)
      }
    }, 1000),
    [onSave]
  )

  // 导航树实时同步（100ms 防抖，Feature 2.10）
  const handleTreeUpdate = useCallback(
    debounce((editor: any) => {
      if (onTreeUpdate) {
        const tree = parseDocToTree(editor.getJSON())
        onTreeUpdate(tree)
      }
    }, 100),
    [onTreeUpdate]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: '开始编写你的剧本...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      CharacterCount.configure({
        limit: 50000,
      }),
      Focus.configure({
        className: 'has-focus',
        mode: 'all',
      }),
      // 自定义节点
      EpisodeNode,
      SceneNode,
      CharacterNode,
      DialogueNode,
      ActionNode,
      EmotionNode,
      CameraNode,
      SoundNode,
      PropNode,
      TransitionNode,
    ],
    content: document.editor_json || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      handleUpdate(editor)
      handleTreeUpdate(editor)
    },
  })

  // 监听文档变化，更新编辑器内容
  useEffect(() => {
    if (editor && document.editor_json) {
      try {
        editor.commands.setContent(document.editor_json, { emitUpdate: false })
      } catch (err) {
        // 内容格式不合法时不崩溃，回退到空文档
        console.warn('编辑器内容加载失败，回退到空文档:', err)
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] }, { emitUpdate: false })
      }
      // 文档加载后立即生成一次导航树（Feature 2.10）
      if (onTreeUpdate) {
        onTreeUpdate(parseDocToTree(editor.getJSON()))
      }
    }
  }, [editor, document.id])

  // 将编辑器实例传递给父组件
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-[500px] text-[#888]">
        加载编辑器...
      </div>
    )
  }

  // 编辑器是否处于空白状态：用于显示引导卡片
  const charCount = editor.storage.characterCount?.characters?.() ?? 0
  const isEmpty =
    charCount === 0 &&
    (!document.editor_json ||
      (typeof document.editor_json === 'object' &&
        (!document.editor_json.content || document.editor_json.content.length === 0)) ||
      (typeof document.editor_json === 'string' && document.editor_json.trim() === ''))

  return (
    <div className="script-editor bg-[#1a1a1a] rounded-lg border border-white/10 relative">
      {/* AI Bubble Menu - 选中文本时显示 */}
      <AIBubbleMenu editor={editor} />
      {/* Slash Command Menu - 输入 / 触发命令 */}
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} />
      {/* 空白状态：明确引导用户如何开始 */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div className="text-sm text-[#888] mb-2">剧本内容为空</div>
          <div className="text-xs text-[#666] max-w-sm">
            点击此处开始编写；或使用顶部"导入导出"粘贴 TXT 文本；
            也可点击"分析"按钮让 AI 提取角色/场景/道具。
          </div>
        </div>
      )}
      {editor.storage.characterCount && (
        <div className="text-xs text-[#666] p-2 border-t border-white/10">
          字数: {editor.storage.characterCount.characters()} / 50,000
        </div>
      )}
    </div>
  )
}