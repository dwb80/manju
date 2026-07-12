/**
 * restructure-script —— AI 分析后重建 Tiptap 文档，使剧集/场景可被结构化锚定
 *
 * 业务背景：
 *   AI 分析只会创建 `script_episodes` / `script_scenes` 两条数据库记录，
 *   但剧本正文（editor_json）仍是纯文本。用户在侧栏点击剧集时，
 *   jumpToNode 通过 `[data-id]` 找不到对应节点，只能回退到纯文本关键字匹配。
 *
 *   本工具在 AI 分析应用阶段，把原文按 AI 识别的场景切片，
 *   重新包装为带 data-id 的 `<episode>` / `<scene>` 节点，
 *   从而让侧栏 → 编辑器的锚定走"结构化定位"通道。
 *
 * 设计原则：
 *   - 单一职责：只负责"原文 → 结构化 Tiptap 文档"这一个变换
 *   - 鲁棒匹配：先尝试匹配 AI 返回的首段对白 → 退回场景描述 → 退回位置均分
 *   - 原文保真：尽量保留用户原始措辞，不做改写
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('restructure-script')

// ============= 类型 =============

/** AI 返回的单条剧集（含嵌套 scenes / dialogues） */
export interface AIAnalyzeEpisode {
  episode_no: number
  title?: string
  synopsis?: string
  scenes?: Array<{
    scene_no: number
    location_name?: string
    time_of_day?: string
    description?: string
    dialogues?: Array<{ character?: string; text?: string; emotion?: string }>
  }>
}

/** 已落库的剧集元数据（用于把 AI 剧集映射到后端 ID） */
export interface EpisodeMeta {
  id: string
  episodeNo: number
  title: string
}

/** 已落库的场景元数据 */
export interface SceneMeta {
  id: string
  episodeNo: number
  sceneNo: number
  location: string
  time: string
}

// ============= 工具函数 =============

/**
 * 在原文中查找子串位置（trim 后匹配）
 * @returns 命中则返回 >=0 的索引；否则返回 -1
 */
function findPosition(haystack: string, needle: string | undefined | null): number {
  if (!needle) return -1
  const cleaned = String(needle).trim()
  if (!cleaned) return -1
  return haystack.indexOf(cleaned)
}

/**
 * 检查 Tiptap 文档是否已包含 episode/scene 节点
 *  - 命中：跳过重建（避免覆盖用户已有的手动结构）
 *  - 未命中：允许重建
 */
export function hasEpisodeNodes(content: any): boolean {
  if (!content || typeof content !== 'object') return false
  const visit = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false
    if (node.type === 'episode' || node.type === 'scene') return true
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (visit(child)) return true
      }
    }
    return false
  }
  return visit(content)
}

// ============= 核心：内容重建 =============

/**
 * 根据 AI 分析结果，把原文重建为带结构化锚点的 Tiptap 文档。
 *
 * @param originalText  原文（来自 editor.getText()）
 * @param aiEpisodes    AI 返回的剧集列表（带 scenes / dialogues）
 * @param episodeMap    key=episode_no, value=已落库的剧集元数据（含 id）
 * @param sceneMap      key=`${episode_no}-${scene_no}`, value=已落库的场景元数据
 * @returns 新的 Tiptap doc 节点；失败时返回 null
 */
export function restructureScriptFromAI(
  originalText: string,
  aiEpisodes: AIAnalyzeEpisode[],
  episodeMap: Map<number, EpisodeMeta>,
  sceneMap: Map<string, SceneMeta>,
): any | null {
  if (!originalText || !Array.isArray(aiEpisodes) || aiEpisodes.length === 0) {
    return null
  }
  if (episodeMap.size === 0) {
    log.warn('restructure skipped: empty episodeMap')
    return null
  }

  // 1) 为每个 scene 找原文起始位置
  type ScenePos = { epNo: number; scNo: number; start: number }
  const scenePositions: ScenePos[] = []

  for (const ep of aiEpisodes) {
    if (!Array.isArray(ep.scenes)) continue
    for (const sc of ep.scenes) {
      let start = -1
      // 优先用对白作为锚点（长对白更唯一）
      if (Array.isArray(sc.dialogues)) {
        const dialogues = sc.dialogues
          .filter((d) => d.text && String(d.text).trim().length >= 3)
          .slice()
          .sort((a, b) => String(b.text).length - String(a.text).length)
        for (const d of dialogues) {
          start = findPosition(originalText, d.text)
          if (start >= 0) break
        }
      }
      // 备选：场景描述
      if (start < 0) {
        start = findPosition(originalText, sc.description)
      }
      scenePositions.push({ epNo: ep.episode_no, scNo: sc.scene_no, start })
    }
  }

  // 2) 按位置升序（未匹配的放最后）
  scenePositions.sort((a, b) => {
    if (a.start < 0 && b.start < 0) return 0
    if (a.start < 0) return 1
    if (b.start < 0) return -1
    return a.start - b.start
  })

  // 3) 计算每个 scene 在原文中的区间
  const segments: Array<{ epNo: number; scNo: number; start: number; end: number }> = []
  for (let i = 0; i < scenePositions.length; i++) {
    const cur = scenePositions[i]
    if (cur.start < 0) continue
    const next = scenePositions[i + 1]
    const end = next && next.start >= 0 ? next.start : originalText.length
    segments.push({ epNo: cur.epNo, scNo: cur.scNo, start: cur.start, end })
  }

  // 4) 拆分原文到对应剧集（用于未匹配 scene 的尾部追加）
  const matchedKeys = new Set(segments.map((s) => `${s.epNo}-${s.scNo}`))
  const unmatchedByEp = new Map<number, AIAnalyzeEpisode['scenes']>()
  for (const ep of aiEpisodes) {
    const unmatched = (ep.scenes || []).filter(
      (sc) => !matchedKeys.has(`${ep.episode_no}-${sc.scene_no}`),
    )
    if (unmatched.length > 0) {
      unmatchedByEp.set(ep.episode_no, unmatched)
    }
  }

  // 5) 构建 Tiptap 文档
  const doc: any = { type: 'doc', content: [] }

  for (const ep of aiEpisodes) {
    const epNo = ep.episode_no
    const epMeta = episodeMap.get(epNo)
    if (!epMeta) continue

    const epContent: any[] = []

    // 5.1) 剧集标题
    if (ep.title) {
      epContent.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: `第${epNo}集 ${ep.title}` }],
      })
    }
    if (ep.synopsis) {
      epContent.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `【梗概】${ep.synopsis}` }],
      })
    }

    // 5.2) 场景列表
    const epSegments = segments.filter((s) => s.epNo === epNo)
    const scenes = ep.scenes || []
    for (const sc of scenes) {
      const scKey = `${epNo}-${sc.scene_no}`
      const scMeta = sceneMap.get(scKey)
      const seg = epSegments.find((s) => s.scNo === sc.scene_no)

      const scContent: any[] = []

      // 场景标题行
      if (sc.location_name) {
        const timeText = sc.time_of_day ? ` · ${sc.time_of_day}` : ''
        scContent.push({
          type: 'paragraph',
          content: [{ type: 'text', text: `【${sc.location_name}${timeText}】` }],
        })
      }

      // 原文片段（按段落切分）
      if (seg && seg.end > seg.start) {
        const segText = originalText.slice(seg.start, seg.end).trim()
        if (segText) {
          const lines = segText
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean)
          for (const line of lines) {
            scContent.push({
              type: 'paragraph',
              content: [{ type: 'text', text: line }],
            })
          }
        }
      } else if (sc.description) {
        // 备选：使用 AI 描述
        scContent.push({
          type: 'paragraph',
          content: [{ type: 'text', text: sc.description }],
        })
      }

      // 包装为 scene 节点（有 id 时）
      if (scMeta && scContent.length > 0) {
        epContent.push({
          type: 'scene',
          attrs: {
            id: scMeta.id,
            location: scMeta.location,
            time: scMeta.time,
            status: 'draft',
          },
          content: scContent,
        })
      } else if (scContent.length > 0) {
        epContent.push(...scContent)
      }
    }

    // 5.3) 包装为 episode 节点
    if (epContent.length > 0) {
      doc.content.push({
        type: 'episode',
        attrs: {
          id: epMeta.id,
          episodeNo: epNo,
          title: ep.title || '',
          synopsis: ep.synopsis || '',
          status: 'draft',
        },
        content: epContent,
      })
    }
  }

  if (doc.content.length === 0) {
    log.warn('restructure produced empty document')
    return null
  }

  log.info('restructure done', {
    episodes: doc.content.length,
    totalScenes: doc.content.reduce(
      (acc: number, ep: any) =>
        acc + (Array.isArray(ep.content) ? ep.content.filter((c: any) => c.type === 'scene').length : 0),
      0,
    ),
  })

  return doc
}
