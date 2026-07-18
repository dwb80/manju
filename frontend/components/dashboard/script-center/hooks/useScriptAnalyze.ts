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
import { scriptCenterService } from '@/services/script-center.service'
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
  scenes: Array<{ id: string; location: string; time?: string; episodeId?: string }>
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

    // === 去重基础设施（修复剧集/场景重复入库） ===
    // 1) 本地 seen Set：避免 preview 数组内部含重复项时反复入库
    // 2) 拿最新 store 状态（useScriptStore.getState）：闭包里的 props/episodes 可能是过期快照
    //    —— 用户在上一轮 apply 还没完成 / 还没回流到 store 时,可能再次点击"应用"导致重入
    const seenEpisodeTitles = new Set<string>()
    const seenCharacterNames = new Set<string>()
    const seenSceneLocations = new Set<string>()  // 工厂资产去重
    const seenScriptSceneLocs = new Set<string>() // 剧本侧去重（key: `${epNo}::${location}`）
    const seenPropNames = new Set<string>()
    const freshStore = useScriptStore.getState()
    const freshEpisodes = freshStore.episodes
    const freshScenes = freshStore.scenes
    const freshSceneAssets = freshStore.sceneAssets
    const freshCharacters = freshStore.characters
    const freshProps = freshStore.props

    try {
      const projectId = document.project_id || ''

      // 1) 剧集：去重添加（三层去重）
      //    - 本次 apply 内 seen Set
      //    - props 闭包快照（首次 apply 时也用得到）
      //    - 最新 store 状态（避免连续 apply 时第二次拿不到第一次的写入）
      for (const ep of preview.episodes) {
        const title = (ep.title || '').trim()
        if (!title) continue
        if (seenEpisodeTitles.has(title)) continue
        seenEpisodeTitles.add(title)
        const existingEpisode = episodes.find((e) => e.title === title) || freshEpisodes.find((e: any) => e.title === title)
        if (existingEpisode) {
          newEpisodes.push({
            id: existingEpisode.id,
            episodeNo: (existingEpisode as any).episodeNo ?? ep.episode_no ?? newEpisodes.length + 1,
            title: existingEpisode.title || title,
          })
          continue
        }
        const created = await createEpisode({
          episodeNo: ep.episode_no,
          title,
          synopsis: ep.synopsis,
        })
        // createEpisode 现已返回新创建的剧集（见 script-store.ts 改造）
        if (created && created.id) {
          newEpisodes.push({
            id: created.id,
            episodeNo: created.episodeNo ?? ep.episode_no ?? newEpisodes.length + 1,
            title: created.title || title,
          })
        }
      }

      // 2) 角色：去重 + 落库到角色工厂 + 追加工厂资产
      for (const char of preview.characters) {
        const cName = (char.name || '').trim()
        if (!cName) continue
        if (seenCharacterNames.has(cName)) continue
        seenCharacterNames.add(cName)
        if (characters.find((c) => c.name === cName) || freshCharacters.find((c: any) => c.name === cName)) {
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
            name: cName,
            role: char.role || 'supporting',
            gender: char.gender || 'other',
            // 修复：AI 识别出年龄（如 28）但 c.age 没传给 createCharacter，
            // 导致工厂角色 age 默认 0。character.service 的 updateCharacter 也是
            // 同样的 age 字段，这里和 import-service 行为保持一致：parseInt 后传数字。
            age:
              typeof char.age === 'number' && Number.isFinite(char.age) && char.age > 0
                ? char.age
                : typeof char.age === 'string' && char.age.trim()
                  ? parseInt(char.age, 10) || undefined
                  : undefined,
            description: mergedDescription,
            traits: char.traits || [],
            tags: ['剧本分析提取'],
          } as any)
          appendFactoryAsset('character', created)
          createdChars++
        } catch (err) {
          log.warn('create character failed', { name: cName, error: (err as Error).message })
          // 落库失败时回退到仅写 store
          addCharacter({
            id: `temp-${Date.now()}-${cName}`,
            name: cName,
            description: mergedDescription,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            assetId: undefined,
          } as any)
        }
      }

      // 3a) 场景工厂资产：preview.scenes(扁平列表) → 按唯一地点去重 → 落库到场景工厂
      //     工厂资产与剧本侧场景解耦：工厂只关心"哪些地点需要资产图",
      //     剧本侧关心"哪些 scene 节点需要写到正文里并打 data-id 锚点"
      for (const scene of preview.scenes) {
        const locationName = (scene.location_name || scene.name || '').trim() || '未命名场景'
        if (seenSceneLocations.has(locationName)) continue
        seenSceneLocations.add(locationName)
        if (sceneAssets.find((s) => s.name === locationName)) continue
        if (freshSceneAssets.find((s: any) => s.name === locationName)) continue
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
      }

      // 3b) 剧本侧场景：preview.episodes[].scenes(嵌套) → 按"剧集归属"创建
      //     锚定功能的关键：每条新场景必须挂到它真正属于的剧集下,
      //     sceneMap 按 `${episodeNo}-${sceneNo}` 与 preview 严格对齐,
      //     这样 restructure 出来的 scene 节点 attrs.id 才是有效的后端 ID,
      //     侧栏 jumpToNode 通过 [data-id] 才能精确命中
      const episodeNoToNew = new Map<number, EpisodeMeta>()
      for (const e of newEpisodes) episodeNoToNew.set(e.episodeNo, e)

      for (const previewEp of preview.episodes) {
        const epNo = previewEp.episode_no || 1
        const hostEp = episodeNoToNew.get(epNo)
        if (!hostEp) continue
        const innerScenes = previewEp.scenes || []
        for (let sIdx = 0; sIdx < innerScenes.length; sIdx++) {
          const sc = innerScenes[sIdx]
          const locationName = (sc.location_name || '').trim() || '未命名场景'
          const sceneNo = sc.scene_no || sIdx + 1
          const dedupKey = `${epNo}::${locationName}`
          if (seenScriptSceneLocs.has(dedupKey)) continue
          seenScriptSceneLocs.add(dedupKey)
          // 已经在 store 里(本剧集 + 同地点)就跳过
          const existingScriptScene =
            scenes.find((s) => s.episodeId === hostEp.id && s.location === locationName) ||
            freshScenes.find((s: any) => s.episodeId === hostEp.id && s.location === locationName)
          if (existingScriptScene) {
            newScriptScenes.push({
              id: existingScriptScene.id,
              episodeNo: epNo,
              sceneNo,
              location: existingScriptScene.location || locationName,
              time: existingScriptScene.time || sc.time_of_day || 'day',
            })
            continue
          }
          try {
            const createdScriptScene = await createScene(hostEp.id, {
              location: locationName,
              time: sc.time_of_day,
              description: sc.description,
            })
            if (createdScriptScene && createdScriptScene.id) {
              newScriptScenes.push({
                id: createdScriptScene.id,
                episodeNo: epNo,
                sceneNo,
                location: createdScriptScene.location || locationName,
                time: createdScriptScene.time || sc.time_of_day || 'day',
              })
            }
          } catch (err) {
            log.warn('create script scene failed', { name: locationName, error: (err as Error).message })
          }
        }
      }

      // 4) 道具：去重 + 落库到道具工厂 + 追加工厂资产
      for (const p of preview.props) {
        const pName = (p.name || '').trim()
        if (!pName) continue
        if (seenPropNames.has(pName)) continue
        seenPropNames.add(pName)
        if (propAssets.find((pp) => pp.name === pName) || freshProps.find((pp: any) => pp.name === pName)) {
          existingProps++
          continue
        }
        try {
          const createdProp = await createFactoryProp({
            project_id: projectId,
            name: pName,
            category: (p.category as any) || 'other',
            description: p.description,
            tags: ['剧本分析提取'],
          } as any)
          appendFactoryAsset('prop', createdProp)
          createdProps++
        } catch (err) {
          log.warn('create prop failed', { name: pName, error: (err as Error).message })
          addProp({
            id: `temp-${Date.now()}-${pName}`,
            name: pName,
            category: p.category,
            description: p.description,
          })
        }
      }

      // 5) 重建 Tiptap 文档：让剧集/场景与正文锚定
      //    - 仅在原文不含 episode/scene 节点时执行（避免覆盖用户手动结构）
      //    - 已存在 / 新创建的剧集都参与映射，否则重复应用分析时无法补齐正文锚点
      //    - 重建后通过回调让 page.tsx 调用 editor.setContent
      if (
        newEpisodes.length > 0 &&
        originalText &&
        !hasEpisodeNodes(originalEditorJson) &&
        onContentRestructured
      ) {
        try {
          // episodeMap: key=episode_no → 落库后的剧集元数据(含后端 id)
          const episodeMap = new Map<number, EpisodeMeta>()
          for (const e of newEpisodes) episodeMap.set(e.episodeNo, e)

          // 强制把 preview 内部的 scene_no 按所在剧集重排为 1..N
          // (与 newScriptScenes 里的 sceneNo 严格对齐,sceneMap 才能命中)
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

          // sceneMap: key=`${episodeNo}-${sceneNo}` → 已落库的场景元数据
          // newScriptScenes 已经在 3b 步骤里按"剧集归属"正确创建,
          // 所以这里直接做扁平化即可,无需再走"塞到第一个剧集"的老路
          const sceneMapByEp: Map<string, SceneMeta> = new Map()
          for (const s of newScriptScenes) {
            sceneMapByEp.set(`${s.episodeNo}-${s.sceneNo}`, s)
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
              episodesWithScenes: newScriptScenes.length,
            })
            notify.info('剧本结构已重建，左侧剧集/场景可点击锚定正文')
          } else {
            log.warn('restructure returned null - 原文与 AI 场景匹配度可能过低,保持原文本')
          }
        } catch (err) {
          log.warn('restructure content failed', { error: (err as Error).message })
        }
      }

      // 6) 写入剧本中心 analyzed-assets（独立表）
      //   - 这是"剧本编辑器右侧面板"的唯一数据源
      //   - 即使上面 2/3a/4 步的工厂写入失败，右侧面板也仍能看到 AI 提取的资产
      //   - factory_*_id 字段用"如果已经命中工厂就带上，没命中就空"——让用户后续可单独"流转到工厂"
      try {
        const projectId = document.project_id || ''
        const matchedFactoryChar = new Map<string, string>()
        for (const c of freshCharacters) matchedFactoryChar.set(c.name, c.id)
        const matchedFactoryScene = new Map<string, string>()
        for (const s of freshSceneAssets) matchedFactoryScene.set(s.name, s.id)
        const matchedFactoryProp = new Map<string, string>()
        for (const p of freshProps) matchedFactoryProp.set(p.name, p.id)

        await scriptCenterService.saveAnalyzedAssets(
          document.id,
          projectId,
          {
            characters: preview.characters.map((c: any) => ({
              name: c.name || '',
              role: c.role || '',
              gender: c.gender || '',
              age: typeof c.age === 'number' ? String(c.age) : (c.age || ''),
              description: c.description || '',
              appearance: c.appearance || '',
              personality: c.personality || '',
              traits: Array.isArray(c.traits) ? c.traits : [],
              tags: [],
              status: 'extracted',
              factory_character_id: matchedFactoryChar.get(c.name),
              importance_level: c.role || '',
            })),
            scenes: preview.scenes.map((s: any) => ({
              name: s.location_name || s.name || '',
              type: s.type || 'outdoor',
              scene_type: s.type || 'outdoor',
              description: s.description || '',
              lighting: '',
              time_of_day: s.time_of_day || '',
              weather: '',
              tags: [],
              status: 'extracted',
              factory_scene_id: matchedFactoryScene.get(s.location_name || s.name),
            })),
            props: preview.props.map((p: any) => ({
              name: p.name || '',
              category: p.category || '',
              description: p.description || '',
              appearance: '',
              material: '',
              size: '',
              color: '',
              tags: [],
              status: 'extracted',
              factory_prop_id: matchedFactoryProp.get(p.name),
            })),
          },
        )
        log.info('analyzed-assets saved to script center', { documentId: document.id })
      } catch (err) {
        // analyzed-assets 写入失败不影响主流程：工厂资产已经写好，notify 用户即可
        log.warn('saveAnalyzedAssets failed (non-fatal)', { error: (err as Error).message })
        notify.warn('剧本中心资产记录失败，请刷新页面重试', '不影响工厂资产')
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
