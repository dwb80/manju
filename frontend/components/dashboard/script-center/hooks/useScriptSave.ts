'use client'

/**
 * useScriptSave —— 剧本保存业务逻辑
 *
 * 设计原则：
 * - 单一职责：仅负责"保存剧本文档 + 同步角色/场景/道具到工厂 + 创建版本快照"
 * - 低耦合：所有依赖通过参数注入，便于单元测试
 * - 集中日志：保存路径上每个关键节点都有模块化日志
 * - 容错：单条同步失败不影响整体保存（fail-soft）
 *
 * 业务说明：
 * - 角色 / 场景 / 道具：剧本侧新条目需落库到对应工厂，并回填 assetId
 *   （场景工厂资产由右侧 ScenePanel 通过 DetailModal 手动同步；本 hook
 *    仍负责"保存剧本时把已有 sceneAssets 一键落库"作为兜底）
 * - AI 分析时（useScriptAnalyze）会独立调一遍 createXxx + appendFactoryAsset，
 *   与本 hook 互为补充：分析时按 AI 提取的内容同步；保存时按 store 当前快照同步。
 */

import { useCallback, useState } from 'react'
import { scriptCenterService } from '@/services/script-center.service'
import { createCharacter } from '@/services/character.service'
import { createScene as createFactoryScene } from '@/services/scene.service'
import { createProp as createFactoryProp } from '@/services/prop.service'
import { toast } from '@/components/common/toast'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('use-script-save')

// 入参类型（仅声明用到的字段，避免过度耦合 store）
export interface UseScriptSaveParams {
  /** 当前文档（必须） */
  document: { id: string; project_id?: string; version: number; title?: string; author?: string; status?: string } | null
  /** Tiptap 编辑器实例（用于获取当前 JSON） */
  editor: any
  /** 待同步到工厂的角色列表 */
  characters: Array<{ id: string; name?: string; description?: string; assetId?: string }>
  /** 待同步到工厂的场景列表 */
  sceneAssets: Array<{ id: string; name?: string; description?: string; type?: string; time_of_day?: string; assetId?: string }>
  /** 待同步到工厂的道具列表 */
  propAssets: Array<{ id: string; name?: string; description?: string; category?: string; assetId?: string }>
  /** store actions：写回 assetId / 追加工厂资产 */
  updateScriptCharacter: (id: string, patch: { assetId?: string }) => void
  updateScriptScene: (id: string, patch: { assetId?: string }) => void
  updateScriptProp: (id: string, patch: { assetId?: string }) => void
  appendFactoryAsset: (kind: 'character' | 'prop' | 'scene', asset: any) => void
}

export interface UseScriptSaveResult {
  /** 触发保存（已加 saving 状态保护） */
  save: () => Promise<void>
  /** 是否正在保存 */
  saving: boolean
}

/**
 * 剧本保存 hook
 */
export function useScriptSave(params: UseScriptSaveParams): UseScriptSaveResult {
  const { document, editor, characters, sceneAssets, propAssets, updateScriptCharacter, updateScriptScene, updateScriptProp, appendFactoryAsset } = params

  const [saving, setSaving] = useState(false)

  const save = useCallback(async () => {
    if (!document) {
      log.warn('save skipped: no document')
      toast.error('当前没有可保存的剧本')
      return
    }
    if (saving) {
      log.debug('save skipped: already saving')
      // 按钮在 saving 时已 disabled，正常流程下不会进入这里
      return
    }

    setSaving(true)
    log.info('save start', { documentId: document.id, characters: characters.length, scenes: sceneAssets.length, props: propAssets.length })

    // 显式的"正在保存"提示：避免用户看不到任何反馈
    //   - 用 progress 类型，带 spinner，用户可感知到保存动作
    //   - 保存完成后替换为 success toast
    const progressId = toast.progress(
      '正在保存剧本…',
      '同步剧本文档与角色 / 道具资产',
    )

    try {
      // 1) 保存剧本文档本身（含 title/author/status 同步）
      const editorJson = editor?.getJSON?.()
      const docPatch: Record<string, unknown> = { editor_json: editorJson }
      // 方案 A 修复：把 title/author/status 一并写入 script_documents，
      // 保证继续编辑页面的 inline-edit 改动能落到主数据源。
      if (document.title !== undefined) docPatch.title = document.title
      if (document.author !== undefined) docPatch.author = document.author
      if (document.status !== undefined) docPatch.status = document.status
      await scriptCenterService.updateDocument(document.id, docPatch as any)
      log.debug('document saved')

      // 2) 同步角色到角色工厂（已同步过 assetId 的跳过）
      const projectId = document.project_id || ''
      let syncedChars = 0
      for (const char of characters) {
        if (char.assetId) continue
        try {
          const created = await createCharacter({
            name: char.name || '未命名角色',
            role: 'supporting',
            description: char.description,
            tags: [],
          } as any)
          updateScriptCharacter(char.id, { assetId: created.id })
          appendFactoryAsset('character', created)
          syncedChars++
        } catch (err) {
          log.warn('sync character failed', { name: char.name, error: (err as Error).message })
        }
      }
      log.info('character sync done', { synced: syncedChars })

      // 3) 同步道具到道具工厂
      let syncedProps = 0
      for (const p of propAssets) {
        if (p.assetId) continue
        try {
          const created = await createFactoryProp({
            project_id: projectId,
            name: p.name || '未命名道具',
            category: (p.category as any) || 'other',
            description: p.description,
          } as any)
          updateScriptProp(p.id, { assetId: created.id })
          appendFactoryAsset('prop', created)
          syncedProps++
        } catch (err) {
          log.warn('sync prop failed', { name: p.name, error: (err as Error).message, stack: (err as Error).stack })
        }
      }
      log.info('prop sync done', { synced: syncedProps })

      // 3.5) 同步场景到场景工厂（store.sceneAssets 一键兜底，AI 分析未覆盖的 sceneAsset 也能补同步）
      let syncedScenes = 0
      for (const s of sceneAssets) {
        if (s.assetId) continue
        try {
          const created = await createFactoryScene({
            project_id: projectId,
            name: s.name || '未命名场景',
            type: (s.type as any) || 'outdoor',
            description: s.description,
            time_of_day: s.time_of_day,
            tags: [],
          } as any)
          updateScriptScene(s.id, { assetId: created.id })
          appendFactoryAsset('scene', created)
          syncedScenes++
        } catch (err) {
          log.warn('sync scene failed', { name: s.name, error: (err as Error).message, stack: (err as Error).stack })
        }
      }
      log.info('scene sync done', { synced: syncedScenes })

      // 4) 创建版本快照（失败不阻塞保存）
      try {
        const snapshot = JSON.stringify(editorJson ?? {})
        await fetch('/api/script-versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: document.id,
            editor_json: snapshot,
            version: document.version + 1,
            changes: '保存',
            type: 'manual',
            created_by: 'user',
          }),
        })
        log.debug('version snapshot created')
      } catch (err) {
        log.warn('version snapshot failed', { error: (err as Error).message })
      }

      const total = syncedChars + syncedProps + syncedScenes
      // 先移除进度 toast，再补一条更显眼的成功反馈
      toast.remove(progressId)
      if (total > 0) {
        toast.success(
          '剧本已保存',
          `已同步 ${syncedChars} 个角色、${syncedProps} 个道具、${syncedScenes} 个场景到工厂`,
          3500,
        )
      } else {
        toast.success('剧本已保存', '文档已写入服务器', 3500)
      }
      log.info('save success', { syncedChars, syncedProps, syncedScenes })
    } catch (error) {
      log.error('save failed', { error: (error as Error).message })
      toast.remove(progressId)
      toast.error('保存失败：' + (error as Error).message, undefined, 4500)
    } finally {
      setSaving(false)
    }
  }, [document, editor, characters, sceneAssets, propAssets, updateScriptCharacter, updateScriptScene, updateScriptProp, appendFactoryAsset, saving])

  return { save, saving }
}
