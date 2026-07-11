// 剧本格式转换工具
// 支持格式: json, txt, markdown, html, fdx

export type ScriptFormat = 'json' | 'txt' | 'markdown' | 'html' | 'fdx'

interface EditorNode {
  type: string
  content?: EditorNode[]
  text?: string
  attrs?: Record<string, any>
  marks?: Array<{ type: string; attrs?: Record<string, any> }>
}

// ========== 导出: editor_json → 各格式 ==========

function extractText(node: EditorNode): string {
  if (node.text) return node.text
  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractText(child)).join('')
  }
  return ''
}

function walkBlocks(node: EditorNode, visitor: (block: EditorNode) => void) {
  const blockTypes = [
    'paragraph', 'heading', 'blockquote', 'codeBlock',
    'bulletList', 'orderedList', 'listItem', 'horizontalRule',
    'episode', 'scene', 'character', 'dialogue', 'parenthetical',
    'action', 'transition', 'scene_heading'
  ]
  if (blockTypes.includes(node.type)) {
    visitor(node)
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((child) => walkBlocks(child, visitor))
  }
}

// 导出为纯文本 TXT
export function editorJsonToTxt(doc: EditorNode): string {
  const lines: string[] = []
  
  walkBlocks(doc, (block) => {
    const text = extractText(block)
    if (block.type === 'heading') {
      const level = block.attrs?.level || 1
      lines.push('')
      lines.push(text)
      lines.push('='.repeat(Math.max(0, 8 - level)))
    } else if (block.type === 'episode') {
      lines.push('')
      lines.push('【剧集】' + text)
      lines.push('')
    } else if (block.type === 'scene_heading' || block.type === 'scene') {
      lines.push('')
      lines.push('【场景】' + text)
      lines.push('')
    } else if (block.type === 'character') {
      lines.push('')
      lines.push('    ' + text.toUpperCase())
    } else if (block.type === 'parenthetical') {
      lines.push('        (' + text + ')')
    } else if (block.type === 'dialogue') {
      // 对话保持缩进
      const indent = '        '
      lines.push(indent + text)
    } else if (block.type === 'action') {
      lines.push(text)
    } else if (block.type === 'transition') {
      lines.push('')
      lines.push('        ' + text.toUpperCase() + '。')
      lines.push('')
    } else if (block.type === 'blockquote') {
      lines.push('> ' + text)
    } else if (block.type === 'codeBlock') {
      lines.push('')
      lines.push(text.split('\n').map((l) => '    ' + l).join('\n'))
      lines.push('')
    } else if (block.type === 'paragraph') {
      lines.push(text)
    } else if (block.type === 'horizontalRule') {
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  })
  
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// 导出为 Markdown
export function editorJsonToMarkdown(doc: EditorNode): string {
  const lines: string[] = []
  
  walkBlocks(doc, (block) => {
    const text = extractText(block)
    const inlineMd = textToInlineMarkdown(block)
    
    if (block.type === 'heading') {
      const level = block.attrs?.level || 1
      lines.push('')
      lines.push('#'.repeat(level) + ' ' + inlineMd)
      lines.push('')
    } else if (block.type === 'episode') {
      lines.push('')
      lines.push('## ' + inlineMd)
      lines.push('')
    } else if (block.type === 'scene_heading' || block.type === 'scene') {
      lines.push('')
      lines.push('### ' + inlineMd)
      lines.push('')
    } else if (block.type === 'character') {
      lines.push('')
      lines.push('**' + text.toUpperCase() + '**')
    } else if (block.type === 'parenthetical') {
      lines.push('*(' + text + ')*')
    } else if (block.type === 'dialogue') {
      lines.push('> ' + inlineMd)
    } else if (block.type === 'action') {
      lines.push('')
      lines.push(inlineMd)
      lines.push('')
    } else if (block.type === 'transition') {
      lines.push('')
      lines.push('> **' + text.toUpperCase() + '**')
      lines.push('')
    } else if (block.type === 'blockquote') {
      lines.push('> ' + inlineMd)
    } else if (block.type === 'codeBlock') {
      const lang = block.attrs?.language || ''
      lines.push('')
      lines.push('```' + lang)
      lines.push(text)
      lines.push('```')
      lines.push('')
    } else if (block.type === 'paragraph') {
      lines.push(inlineMd)
    } else if (block.type === 'horizontalRule') {
      lines.push('')
      lines.push('---')
      lines.push('')
    } else if (block.type === 'listItem') {
      lines.push('- ' + inlineMd)
    }
  })
  
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function textToInlineMarkdown(node: EditorNode): string {
  if (node.text) {
    let text = node.text
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === 'bold') text = `**${text}**`
        if (mark.type === 'italic') text = `*${text}*`
        if (mark.type === 'underline') text = `<u>${text}</u>`
        if (mark.type === 'strike') text = `~~${text}~~`
        if (mark.type === 'code') text = `\`${text}\``
      })
    }
    return text
  }
  if (Array.isArray(node.content)) {
    return node.content.map((child) => textToInlineMarkdown(child)).join('')
  }
  return ''
}

// 导出为 HTML
export function editorJsonToHtml(doc: EditorNode): string {
  const md = editorJsonToMarkdown(doc)
  const htmlBody = markdownToHtml(md)
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>剧本</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.8;
      color: #333;
      background: #f9f9f9;
    }
    h1, h2, h3, h4 { color: #222; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    blockquote {
      border-left: 4px solid #666;
      margin: 1em 0;
      padding: 0.5em 1em;
      color: #555;
      background: #f0f0f0;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 2em 0;
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`
}

function markdownToHtml(md: string): string {
  let html = md
  
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>')
  
  html = html.replace(/^---$/gm, '<hr>')
  
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
  
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>`)
  
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
  
  html = html.split('\n').map((line) => {
    if (
      line.trim() === '' ||
      line.startsWith('<h') ||
      line.startsWith('<hr') ||
      line.startsWith('<blockquote') ||
      line.startsWith('</blockquote') ||
      line.startsWith('<ul') ||
      line.startsWith('</ul') ||
      line.startsWith('<li') ||
      line.startsWith('</li') ||
      line.startsWith('<pre') ||
      line.startsWith('</pre')
    ) {
      return line
    }
    return `<p>${line}</p>`
  }).join('\n')
  
  html = html.replace(/\n{2,}/g, '\n')
  
  return html
}

// 导出为 Final Draft FDX (简化版)
export function editorJsonToFdx(doc: EditorNode): string {
  const content = editorJsonToFdxContent(doc)
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${content}
  </Content>
</FinalDraft>`
}

function editorJsonToFdxContent(doc: EditorNode): string {
  const paragraphs: string[] = []
  
  walkBlocks(doc, (block) => {
    const text = extractText(block)
    let type = 'Action'
    
    if (block.type === 'scene_heading' || block.type === 'scene') {
      type = 'Scene Heading'
    } else if (block.type === 'character') {
      type = 'Character'
    } else if (block.type === 'dialogue') {
      type = 'Dialogue'
    } else if (block.type === 'parenthetical') {
      type = 'Parenthetical'
    } else if (block.type === 'transition') {
      type = 'Transition'
    } else if (block.type === 'episode') {
      type = 'Scene Heading'
    } else if (block.type === 'heading') {
      type = 'Scene Heading'
    } else if (block.type === 'action') {
      type = 'Action'
    } else if (block.type === 'paragraph') {
      type = 'Action'
    }
    
    paragraphs.push(`    <Paragraph Type="${type}">
      <Text>${escapeXml(text)}</Text>
    </Paragraph>`)
  })
  
  return paragraphs.join('\n')
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ========== 导入: 各格式 → editor_json ==========

// 从 TXT 解析为 editor_json
export function txtToEditorJson(text: string): EditorNode {
  const lines = text.split('\n')
  const content: EditorNode[] = []
  
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (!trimmed) {
      i++
      continue
    }
    
    // 场景标题
    if (/^(【场景】|场景:|场景：|INT\.|EXT\.|INT\/EXT|内景|外景|室内|室外)/i.test(trimmed)) {
      content.push({
        type: 'scene_heading',
        content: [{ type: 'text', text: trimmed.replace(/^【场景】/, '') }],
      })
      i++
      continue
    }
    
    // 剧集标题
    if (/^(【剧集】|第.*集|Episode)/i.test(trimmed)) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: trimmed }],
      })
      i++
      continue
    }
    
    // 角色名 (4个空格缩进 + 全大写)
    if (/^    [A-Z\u4e00-\u9fa5]+$/.test(line) && !line.includes('。') && !line.includes('，')) {
      const charName = trimmed
      const nextLine = lines[i + 1] || ''
      
      content.push({
        type: 'character',
        content: [{ type: 'text', text: charName }],
      })
      
      // 检查括号里的提示
      let j = i + 1
      if (/^\s*\(.*\)\s*$/.test(nextLine)) {
        content.push({
          type: 'parenthetical',
          content: [{ type: 'text', text: nextLine.trim().slice(1, -1) }],
        })
        j++
      }
      
      // 收集对话行
      const dialogueLines: string[] = []
      while (j < lines.length && lines[j].trim()) {
        dialogueLines.push(lines[j].trim())
        j++
      }
      
      if (dialogueLines.length > 0) {
        content.push({
          type: 'dialogue',
          content: [{ type: 'text', text: dialogueLines.join('') }],
        })
      }
      
      i = j
      continue
    }
    
    // 转场
    if (/^(切到|淡出|淡入|FADE OUT|FADE IN|CUT TO|DISSOLVE)/i.test(trimmed)) {
      content.push({
        type: 'transition',
        content: [{ type: 'text', text: trimmed }],
      })
      i++
      continue
    }
    
    // 默认作为动作描述
    const actionLines: string[] = [trimmed]
    let j = i + 1
    while (j < lines.length && lines[j].trim() && !/^(    |【|场景|第.*集|INT\.|EXT\.)/.test(lines[j])) {
      actionLines.push(lines[j].trim())
      j++
    }
    
    content.push({
      type: 'action',
      content: [{ type: 'text', text: actionLines.join('') }],
    })
    i = j
  }
  
  return { type: 'doc', content }
}

// 从 Markdown 解析为 editor_json
export function markdownToEditorJson(md: string): EditorNode {
  const lines = md.split('\n')
  const content: EditorNode[] = []
  
  let i = 0
  let inCodeBlock = false
  let codeLines: string[] = []
  let codeLang = ''
  
  while (i < lines.length) {
    const line = lines[i]
    
    // 代码块
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        content.push({
          type: 'codeBlock',
          attrs: { language: codeLang },
          content: [{ type: 'text', text: codeLines.join('\n') }],
        })
        inCodeBlock = false
      }
      i++
      continue
    }
    
    if (inCodeBlock) {
      codeLines.push(line)
      i++
      continue
    }
    
    const trimmed = line.trim()
    
    if (!trimmed) {
      i++
      continue
    }
    
    // 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarkdown(headingMatch[2]),
      })
      i++
      continue
    }
    
    // 分割线
    if (/^---+$/.test(trimmed)) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }
    
    // 引用块
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.slice(2)
      // 检查是否是角色对话格式
      if (/^\*\*(.+?)\*\*$/.test(quoteText)) {
        const charMatch = quoteText.match(/^\*\*(.+?)\*\*$/)
        if (charMatch) {
          content.push({
            type: 'character',
            content: [{ type: 'text', text: charMatch[1] }],
          })
          i++
          continue
        }
      }
      if (/^\*\((.+?)\)\*$/.test(quoteText)) {
        const parenMatch = quoteText.match(/^\*\((.+?)\)\*$/)
        if (parenMatch) {
          content.push({
            type: 'parenthetical',
            content: [{ type: 'text', text: parenMatch[1] }],
          })
          i++
          continue
        }
      }
      
      content.push({
        type: 'blockquote',
        content: parseInlineMarkdown(quoteText),
      })
      i++
      continue
    }
    
    // 列表项
    if (/^[-*+]\s+/.test(trimmed)) {
      content.push({
        type: 'listItem',
        content: parseInlineMarkdown(trimmed.replace(/^[-*+]\s+/, '')),
      })
      i++
      continue
    }
    
    // 默认段落
    content.push({
      type: 'paragraph',
      content: parseInlineMarkdown(trimmed),
    })
    i++
  }
  
  return { type: 'doc', content }
}

function parseInlineMarkdown(text: string): EditorNode[] {
  const nodes: EditorNode[] = []
  let remaining = text
  let currentMarks: Array<{ type: string }> = []
  
  const patterns = [
    { regex: /\*\*(.*?)\*\*/, type: 'bold' },
    { regex: /\*(.*?)\*/, type: 'italic' },
    { regex: /`([^`]+)`/, type: 'code' },
    { regex: /~~(.*?)~~/, type: 'strike' },
  ]
  
  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; text: string; type: string } | null = null
    
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex)
      if (match && match.index !== undefined) {
        if (earliestMatch === null || match.index < earliestMatch.index) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            text: match[1],
            type: pattern.type,
          }
        }
      }
    }
    
    if (!earliestMatch) {
      nodes.push({ type: 'text', text: remaining })
      break
    }
    
    if (earliestMatch.index > 0) {
      nodes.push({ type: 'text', text: remaining.slice(0, earliestMatch.index) })
    }
    
    nodes.push({
      type: 'text',
      text: earliestMatch.text,
      marks: [{ type: earliestMatch.type }],
    })
    
    remaining = remaining.slice(earliestMatch.index + earliestMatch.length)
  }
  
  return nodes
}

// 从 HTML 解析为 editor_json
export function htmlToEditorJson(html: string): EditorNode {
  // 简单实现：先提取 body，然后转成 markdown 再解析
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  
  // 去除 style 和 script
  let cleaned = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  const md = htmlToMarkdown(cleaned)
  return markdownToEditorJson(md)
}

function htmlToMarkdown(html: string): string {
  let md = html
  
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')
  
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n')
  
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '')
  
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
  
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n')
  
  md = md.replace(/<[^>]+>/g, '')
  
  md = md.replace(/&nbsp;/g, ' ')
  md = md.replace(/&amp;/g, '&')
  md = md.replace(/&lt;/g, '<')
  md = md.replace(/&gt;/g, '>')
  md = md.replace(/&quot;/g, '"')
  
  return md.trim()
}

// 从 FDX 解析为 editor_json
export function fdxToEditorJson(fdx: string): EditorNode {
  const content: EditorNode[] = []
  
  // 提取所有 Paragraph
  const paragraphRegex = /<Paragraph[^>]*Type="([^"]+)"[^>]*>([\s\S]*?)<\/Paragraph>/g
  let match
  
  while ((match = paragraphRegex.exec(fdx)) !== null) {
    const type = match[1]
    const paragraphContent = match[2]
    
    // 提取文本
    const textMatch = paragraphContent.match(/<Text[^>]*>([\s\S]*?)<\/Text>/)
    let text = textMatch ? textMatch[1] : ''
    
    // 清理文本
    text = text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
    
    let nodeType = 'paragraph'
    
    switch (type) {
      case 'Scene Heading':
        nodeType = 'scene_heading'
        break
      case 'Character':
        nodeType = 'character'
        break
      case 'Dialogue':
        nodeType = 'dialogue'
        break
      case 'Parenthetical':
        nodeType = 'parenthetical'
        break
      case 'Transition':
        nodeType = 'transition'
        break
      case 'Action':
      default:
        nodeType = 'action'
        break
    }
    
    content.push({
      type: nodeType,
      content: [{ type: 'text', text }],
    })
  }
  
  if (content.length === 0) {
    // FDX 解析失败则用 txt 方式解析
    return txtToEditorJson(fdx)
  }
  
  return { type: 'doc', content }
}

// 统一导出函数
export function exportScript(doc: EditorNode, format: ScriptFormat, title: string = '剧本'): { content: string; filename: string; mimeType: string } {
  let content = ''
  let filename = ''
  let mimeType = ''
  
  switch (format) {
    case 'json':
      content = JSON.stringify(doc, null, 2)
      filename = `${title}.json`
      mimeType = 'application/json'
      break
    case 'txt':
      content = editorJsonToTxt(doc)
      filename = `${title}.txt`
      mimeType = 'text/plain;charset=utf-8'
      break
    case 'markdown':
      content = editorJsonToMarkdown(doc)
      filename = `${title}.md`
      mimeType = 'text/markdown;charset=utf-8'
      break
    case 'html':
      content = editorJsonToHtml(doc)
      filename = `${title}.html`
      mimeType = 'text/html;charset=utf-8'
      break
    case 'fdx':
      content = editorJsonToFdx(doc)
      filename = `${title}.fdx`
      mimeType = 'application/xml;charset=utf-8'
      break
  }
  
  return { content, filename, mimeType }
}

// 统一导入函数
export function importScript(text: string, format: ScriptFormat): EditorNode {
  switch (format) {
    case 'json':
      try {
        const parsed = JSON.parse(text)
        return parsed.editor_json || parsed
      } catch {
        return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
      }
    case 'txt':
      return txtToEditorJson(text)
    case 'markdown':
      return markdownToEditorJson(text)
    case 'html':
      return htmlToEditorJson(text)
    case 'fdx':
      return fdxToEditorJson(text)
    default:
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
  }
}

// 从文件名推断格式
export function detectFormat(filename: string): ScriptFormat | null {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'json': return 'json'
    case 'txt': return 'txt'
    case 'md':
    case 'markdown': return 'markdown'
    case 'html':
    case 'htm': return 'html'
    case 'fdx': return 'fdx'
    default: return null
  }
}
