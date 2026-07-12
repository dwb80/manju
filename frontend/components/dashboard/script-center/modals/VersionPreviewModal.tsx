'use client'

/**
 * VersionPreviewModal —— 版本内容预览弹窗
 *
 * 设计原则：
 * - 单一职责：负责"展示某个历史版本的文本预览"
 * - 复用基座：基于 DraggableModal 实现
 * - 文本提取逻辑：从 editor_json 中递归提取纯文本，兼容字符串 / 对象 / script_document 嵌套
 */

import { DraggableModal } from './DraggableModal'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('version-preview-modal')

type ScriptVersion = {
  id: string
  version: number
  timestamp: string
  changes: string
  author?: string
  content: any
}

export interface VersionPreviewModalProps {
  /** 待预览的版本 */
  version: ScriptVersion
  onClose: () => void
}

/**
 * 从 editor_json 中提取纯文本（递归遍历 ProseMirror 节点）
 *
 * 兼容以下结构：
 * 1. 直接传入 ProseMirror JSON
 * 2. JSON 字符串
 * 3. `{ script_document: {...} }`（后端 ScriptBackup 格式）
 * 4. `{ editor_json: {...} }`（带包装的对象）
 */
function extractTextFromEditorJson(content: any): string {
  if (!content) return '（无内容）'
  let json = content
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json)
    } catch {
      return json
    }
  }
  if (json.script_document) return extractTextFromEditorJson(json.script_document)
  if (json.editor_json) return extractTextFromEditorJson(json.editor_json)

  // 递归收集段落级文本
  const blocks: string[] = []
  const collectText = (node: any): string => {
    if (!node) return ''
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.content)) return node.content.map(collectText).join('')
    return ''
  }
  const walk = (node: any) => {
    if (!node) return
    if (['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'].includes(node.type)) {
      blocks.push(collectText(node))
      return
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk)
    } else if (typeof node.text === 'string') {
      blocks.push(node.text)
    }
  }
  walk(json)
  return blocks.join('\n') || '（无文本内容）'
}

/**
 * 版本预览弹窗组件
 */
export function VersionPreviewModal({ version, onClose }: VersionPreviewModalProps) {
  log.debug('open', { versionId: version.id, version: version.version })

  return (
    <DraggableModal
      title={`版本 V${version.version} - ${new Date(version.timestamp).toLocaleString()}`}
      onClose={onClose}
      width={640}
      maxHeight={Math.min(640, typeof window !== 'undefined' ? window.innerHeight - 80 : 640)}
    >
      {version.changes && (
        <div className="text-xs text-[#888] px-4 pt-2">{version.changes}</div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        <pre className="text-xs text-[#ccc] whitespace-pre-wrap">
          {extractTextFromEditorJson(version.content)}
        </pre>
      </div>
    </DraggableModal>
  )
}
