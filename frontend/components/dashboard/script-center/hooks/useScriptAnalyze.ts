'use client'

/**
 * useScriptAnalyze —— AI 剧本分析业务逻辑
 *
 * 设计原则：
 * - 单一职责：仅负责"把 AI/本地正则分析结果落库到工厂 + 写回 store"
 * - 低耦合：所有 store action 通过参数注入，便于单元测试
 * - 集中日志：分析路径上每个关键节点都有模块化日志
 * - 容错：单条同步失败不影响整体应用（fail-soft）
 *
 * 三步流程（page.tsx 编排，hook 只承担第三步"应用"）：
 *   1) 打开确认弹窗（page.tsx）
 *   2) 调用 scriptCenterService.analyzeScript（page.tsx）
 *   3) 应用分析结果（本 hook 负责：剧集/角色/场景/道具 落库到工厂 + 写回 store）
 *
 * 业务说明：
 * - 角色 / 道具：去重（按 name）+ 落库到工厂 + 追加工厂资产
 * - 场景：去重 + 落库到场景工厂 + 写入剧本侧 ScriptSidebar
 * - 剧集：去重 + 写入剧本 store（不在工厂）
 */

import { useCallback, useState } from 'react'
import { useScriptStore } from '@/lib/stores/script-store'
import { createCharacter } from '@/services/character.service'
import { createScene as createFactoryScene } from '@/services/scene.service'
import { createProp as createFactoryProp } from '@/services/prop.service'
import { notify } from '@/lib/notify'
import { createLogger } from '@/lib/logger'
import {
  restructureScriptFromAI,
  hasEpisodeNodes,
  type EpisodeMeta,
  type SceneMeta,
  type AIAnalyzeEpisode,
} from '@/lib/utils/restructure-script'

// 模块级 logger
const log = createLogger('use-script-analyze')

// === 类型定义 ===

/** AI/本地正则分析返回的最小项 */
export interface AnalyzeItem {
  name: string
  description?: string
  location_name?: string
  time_of_day?: string
  episode_no?: number
  title?: string
  synopsis?: string
  category?: string
  scenes?: AIAnalyzeEpisode['scenes']
  [key: string]: any
}

export interface AnalyzePreviewData {
  characters: AnalyzeItem[]
  scenes: AnalyzeItem[]
  props: AnalyzeItem[]
  episodes: AnalyzeItem[]
  source?: 'ai' | 'local'
  warnings?: string[]
}

// === 入参类型（仅声明用到的字段，避免过度耦合 store） ===

export interface UseScriptAnalyzeParams {
  /** 当前文档（仅需 id 与 project_id） */
  document: { id: string; project_id?: string } | null
  /** 待写入的预览数据 */
  preview: AnalyzePreviewData | null

  // store 状态（用于去重判断）
  episodes: Array<{ id: string; title: string }>
  scenes: Array<{ id: string; location: string }>
  sceneAssets: Array<{ id: string; name: string }>
  characters: Array<{ id: string; name: string }>
  propAssets: Array<{ id: string; name: string }>

  // store actions
  createEpisode: (data: any) => Promise<any>
  createScene: (episodeId: string, data: any) => Promise<any>
  addCharacter: (data: any) => void
  addProp: (data: any) => void
  appendFactoryAsset: (kind: 'character' | 'scene' | 'prop', asset: any) => void

  /** 原始剧本文本（plain text）。用于 AI 分析后重建结构化 Tiptap 文档 */
  originalText?: string
  /** 原始 Tiptap 文档（JSON）。已含 episode/scene 节点时跳过重建 */
  originalEditorJson?: any
  /** 重建后的 Tiptap JSON 回调（供编辑器 setContent 用） */
  onContentRestructured?: (newContent: any) => void
}

export interface UseScriptAnalyzeResult {
  /** 应用分析结果（已加 applying 状态保护） */
  apply: () => Promise<{ success: boolean }>
  /** 是否正在应用 */
  applying: boolean
}

// === 主 hook ===
export function useScriptAnalyze(params: UseScriptAnalyzeParams): UseScriptAnalyzeResult {
  const {
    document,
    preview,
    episodes,
    scenes,
    sceneAssets,
    characters,
    propAssets,
    createEpisode,
    createScene,
    addCharacter,
    addProp,
    appendFactoryAsset,
    originalText,
    originalEditorJson,
    onContentRestructured,
  } = params

  const [applying, setApplying] = useState(false)

  const apply = useCallback(async (): Promise<{ success: boolean }> => {
    if (!preview) {
      log.warn('apply skipped: no preview')
      return { success: false }
    }
    if (applying) {
      log.debug('apply skipped: already applying')
      return { success: false }
    }
    if (!document) {
      notify.error('文档不存在，无法应用分析结果')
      return { success: false }
    }

    setApplying(true)
    log.info('apply start', {
      counts: {
        characters: preview.characters.length,
        scenes: preview.scenes.length,
        props: preview.props.length,
        episodes: preview.episodes.length,
      },
    })

    let createdChars = 0
    let createdScenes = 0
    let createdProps = 0
    let existingChars = 0
    let existingScenes = 0
    let existingProps = 0

    // 用于"AI 分析 → 重建结构化文档"：记录本次新建的剧集/场景的 id
    const newEpisodes: EpisodeMeta[] = []
    const newScriptScenes: SceneMeta[] = []

    try {
      const projectId = document.project_id || ''

      // 1) 剧集：去重添加
      for (const ep of preview.episodes) {
        const exist = episodes.find((e) => e.title === ep.title)
        if (exist) continue
        const created = await createEpisode({
          episodeNo: ep.episode_no,
          title: ep.title,
          synopsis: ep.synopsis,
        })
        // createEpisode 现已返回新创建的剧集（见 script-store.ts 改造）
        if (created && created.id) {
          newEpisodes.push({
            id: created.id,
            episodeNo: created.episodeNo ?? ep.episode_no ?? newEpisodes.length + 1,
            title: created.title || ep.title || '',
          })
        }
      }

      // 2) 角色：去重 + 落库到角色工厂 + 追加工厂资产
      for (const char of preview.characters) {
        if (characters.find((c) => c.name === char.name)) {
          existingChars++
          continue
        }
        const descParts: string[] = []
        if (char.appearance) descParts.push(`【外貌】${char.appearance}`)
        if (char.personality) descParts.push(`【性格】${char.personality}`)
        if (!descParts.length && char.description) descParts.push(char.description)
        const mergedDescription = descParts.join('\n') || char.description || ''

        try {
          const created = await createCharacter({
            project_id: projectId,
            name: char.name,
            role: char.role || 'supporting',
            gender: char.gender || 'other',
            description: mergedDescription,
            traits: char.traits || [],
            tags: ['剧本分析提取'],
          } as any)
          appendFactoryAsset('character', created)
          createdChars++
        } catch (err) {
          log.warn('create character failed', { name: char.name, error: (err as Error).message })
          // 落库失败时回退到仅写 store
          addCharacter({
            id: `temp-${Date.now()}-${char.name}`,
            name: char.name,
            description: mergedDescription,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            assetId: undefined,
          } as any)
        }
      }

      // 3) 场景：去重 + 落库到场景工厂 + 写入剧本侧
      //    若当前还没有剧集，从 store 重读（异步一致性兜底）
      const targetEpisodes: Array<{ id: string; title: string; episodeNo?: number }> =
        episodes.length > 0 ? (episodes as any) : (useScriptStore.getState().episodes as any)
      for (let i = 0; i < preview.scenes.length; i++) {
        const scene = preview.scenes[i]
        const locationName = scene.location_name || scene.name || '未命名场景'
        const inScript = scenes.find((s) => s.location === locationName)
        const inFactory = sceneAssets.find((s) => s.name === locationName)
        if (inScript || inFactory) {
          existingScenes++
          continue
        }
        try {
          const createdScene = await createFactoryScene({
            name: locationName,
            type: (scene.type as any) || 'outdoor',
            description: scene.description,
            time_of_day: scene.time_of_day,
            tags: ['剧本分析提取'],
          })
          appendFactoryAsset('scene', createdScene)
          createdScenes++
        } catch (err) {
          log.warn('create scene factory asset failed', { name: locationName, error: (err as Error).message })
        }
        if (targetEpisodes.length > 0) {
          try {
            // 默认归属到第一个剧集；多集归属留给后续按 AI first_appearance 解析
            const hostEp = targetEpisodes[0]
            const createdScriptScene = await createScene(hostEp.id, {
              location: locationName,
              time: scene.time_of_day,
              description: scene.description,
            })
            if (createdScriptScene && createdScriptScene.id) {
              newScriptScenes.push({
                id: createdScriptScene.id,
                // 兜底按 i 编号；与 AI episodes 内嵌 scenes 的下标不一定完全对齐
                // （因为 AI 的 scenes 在每个 episode 内独立编号 1..N），
                // 此处用绝对顺序作为 SceneMeta.sceneNo，restructure 侧用此顺序与 preview.scenes 对应
                episodeNo: hostEp.episodeNo ?? 1,
                sceneNo: i + 1,
                location: createdScriptScene.location || locationName,
                time: createdScriptScene.time || scene.time_of_day || 'day',
              })
            }
          } catch (err) {
            log.warn('create script scene failed', { name: locationName, error: (err as Error).message })
          }
        }
      }

      // 4) 道具：去重 + 落库到道具工厂 + 追加工厂资产
      for (const p of preview.props) {
        if (propAssets.find((pp) => pp.name === p.name)) {
          existingProps++
          continue
        }
        try {
          const createdProp = await createFactoryProp({
            project_id: projectId,
            name: p.name,
            category: (p.category as any) || 'other',
            description: p.description,
            tags: ['剧本分析提取'],
          } as any)
          appendFactoryAsset('prop', createdProp)
          createdProps++
        } catch (err) {
          log.warn('create prop failed', { name: p.name, error: (err as Error).message })
          addProp({
            id: `temp-${Date.now()}-${p.name}`,
            name: p.name,
            category: p.category,
            description: p.description,
          })
        }
      }

      // 5) 重建 Tiptap 文档：让剧集/场景与正文锚定
      //    - 仅在原文不含 episode/scene 节点时执行（避免覆盖用户手动结构）
      //    - 仅在成功创建了至少一个剧集时执行
      //    - 重建后通过回调让 page.tsx 调用 editor.setContent
      if (
        newEpisodes.length > 0 &&
        originalText &&
        !hasEpisodeNodes(originalEditorJson) &&
        onContentRestructured
      ) {
        try {
          const episodeMap = new Map<number, EpisodeMeta>()
          for (const e of newEpisodes) episodeMap.set(e.episodeNo, e)
          // sceneMap key: `${epNo}-${sceneNo}`
          // preview.scenes（顶层）只包含位置/time_of_day/description，
          // 没有 episode 归属，因此这里把全部 newScriptScenes 放进第一个剧集
          // （与上面 createScene 实际行为一致）。
          // 若用户实际是按剧集分布结构（AI 返回嵌套 scenes），下面会按 preview.episodes 重组。
          const sceneMap = new Map<string, SceneMeta>()
          for (const s of newScriptScenes) {
            sceneMap.set(`${s.episodeNo}-${s.sceneNo}`, s)
          }

          // 重组 preview.scenes → 按 preview.episodes 内嵌 scenes 重新编号
          // 让 restore 的 sceneNo 与 store 的 sceneMap 一一对应
          const rewrittenPreviewEpisodes: AIAnalyzeEpisode[] = preview.episodes.map((ep) => {
            const epNo = ep.episode_no || 1
            const innerScenes = (ep.scenes || []).map((sc: any, idx: number) => ({
              ...sc,
              scene_no: idx + 1,
            }))
            return {
              episode_no: epNo,
              title: ep.title,
              synopsis: ep.synopsis,
              scenes: innerScenes,
            }
          })
          // 重新生成 sceneMap key：按 epNo 与 (ep.scenes 的顺序) 对应
          //   newScriptScenes[i] 对应 rewrittenPreviewEpisodes[0].scenes[i]？
          //   上面 createScene 全部塞到 targetEpisodes[0]，但 AI 可能把场景归属到不同剧集。
          //   这里采取保守策略：把 newScriptScenes 全部归属到 rewrittenPreviewEpisodes 的第一个剧集，
          //   sceneNo 按 i+1。后续若多剧集归属，按 AI 的 first_appearance 进一步切分（此处仅做最简版）。
          const sceneMapByEp: Map<string, SceneMeta> = new Map()
          if (rewrittenPreviewEpisodes.length > 0) {
            const firstEpNo = rewrittenPreviewEpisodes[0].episode_no
            for (let i = 0; i < newScriptScenes.length; i++) {
              sceneMapByEp.set(`${firstEpNo}-${i + 1}`, newScriptScenes[i])
            }
          }

          const newContent = restructureScriptFromAI(
            originalText,
            rewrittenPreviewEpisodes,
            episodeMap,
            sceneMapByEp,
          )
          if (newContent) {
            onContentRestructured(newContent)
            log.info('editor content restructured', {
              episodes: rewrittenPreviewEpisodes.length,
              scenes: newScriptScenes.length,
            })
            notify.info('剧本结构已重建，左侧剧集/场景可点击锚定正文')
          }
        } catch (err) {
          log.warn('restructure content failed', { error: (err as Error).message })
        }
      }

      log.info('apply success', { createdChars, createdScenes, createdProps, existingChars, existingScenes, existingProps })
      notify.success(
        `分析结果已应用！新建 ${createdChars} 个角色 / ${createdScenes} 个场景 / ${createdProps} 个道具（已存在 ${existingChars}/${existingScenes}/${existingProps}）`,
      )
      return { success: true }
    } catch (error) {
      log.error('apply failed', { error: (error as Error).message })
      notify.error('应用失败：' + (error as Error).message)
      return { success: false }
    } finally {
      setApplying(false)
    }
  }, [
    document,
    preview,
    episodes,
    scenes,
    sceneAssets,
    characters,
    propAssets,
    createEpisode,
    createScene,
    addCharacter,
    addProp,
    appendFactoryAsset,
    originalText,
    originalEditorJson,
    onContentRestructured,
    applying,
  ])

  return { apply, applying }
}
