'use client'

/**
 * useFilterState —— 通用列表筛选状态管理 Hook
 *
 * 设计动机（评审 P1-工厂页加 tab）：
 * - 工厂页需要"全部 / 最近使用 / 我创建的 / 已收藏"四个维度的快速切换
 * - 三个工厂（角色/场景/道具）都需要相同能力
 * - 抽到本 hook 中复用：状态 + 切换 + 派生数据
 *
 * 设计原则：
 * - 单一职责：仅管理筛选状态 + 派生过滤后的数据
 * - 低耦合：所有数据/回调通过参数注入
 * - 集中日志：所有筛选切换都有模块化日志
 * - 容错：缺失 createdBy/isFavorited 字段时优雅降级
 *
 * 使用示例：
 *   const { activeTab, setActiveTab, filteredItems, tabConfig } = useFilterState({
 *     items: characters,
 *     getUpdatedAt: (c) => c.updated_at,
 *     getCreatedBy: (c) => c.created_by,
 *     getIsFavorited: (c) => c.is_favorited,
 *     currentUserId: user.id,
 *     pageSize: 24,
 *   })
 */

import { useState, useCallback, useMemo } from 'react'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('use-filter-state')

// === 筛选 Tab 类型 ===
export type FilterTabId = 'all' | 'recent' | 'mine' | 'favorites'

export interface FilterTabConfig {
  /** Tab 唯一标识 */
  id: FilterTabId
  /** 显示标签 */
  label: string
  /** Tab 角标（可选，如"3"） */
  badge?: number
  /** 字段缺失时是否隐藏该 Tab（默认 false，降级到全部） */
  hideIfUnsupported?: boolean
}

// === 入参 ===
export interface UseFilterStateParams<T> {
  /** 原始数据 */
  items: T[]
  /** 提取"更新时间"字段（用于"最近使用"） */
  getUpdatedAt: (item: T) => string | undefined
  /** 提取"创建者"字段（用于"我创建的"） */
  getCreatedBy?: (item: T) => string | undefined
  /** 提取"是否收藏"字段（用于"已收藏"） */
  getIsFavorited?: (item: T) => boolean | undefined
  /** 当前登录用户 ID（用于"我创建的"判断） */
  currentUserId?: string
  /** "最近使用"Tab 默认显示数量 */
  pageSize?: number
  /** 初始激活 Tab（默认 'all'） */
  initialTab?: FilterTabId
  /** 模块名（用于日志） */
  moduleName?: string
}

// === 返回值 ===
export interface UseFilterStateResult<T> {
  /** 当前激活的 Tab */
  activeTab: FilterTabId
  /** 切换 Tab */
  setActiveTab: (tab: FilterTabId) => void
  /** 过滤/排序后的数据 */
  filteredItems: T[]
  /** Tab 配置（带动态 badge） */
  tabConfig: FilterTabConfig[]
  /** 当前 Tab 下的数量 */
  currentCount: number
  /** 总数量（无筛选） */
  totalCount: number
}

// === 主 Hook ===
export function useFilterState<T>(params: UseFilterStateParams<T>): UseFilterStateResult<T> {
  const {
    items,
    getUpdatedAt,
    getCreatedBy,
    getIsFavorited,
    currentUserId,
    pageSize = 50,
    initialTab = 'all',
    moduleName = 'list',
  } = params

  const [activeTab, setActiveTabState] = useState<FilterTabId>(initialTab)

  const setActiveTab = useCallback((tab: FilterTabId) => {
    log.debug('switch tab', { module: moduleName, from: activeTab, to: tab })
    setActiveTabState(tab)
  }, [activeTab, moduleName])

  // === 各 Tab 计数（用于 badge） ===
  const counts = useMemo(() => {
    const now = Date.now()
    const recentThreshold = 7 * 24 * 60 * 60 * 1000 // 7 天

    let allCount = 0
    let recentCount = 0
    let mineCount = 0
    let favoritesCount = 0

    for (const item of items) {
      allCount++

      // 最近使用：updatedAt 在最近 7 天内
      const updatedAt = getUpdatedAt(item)
      if (updatedAt) {
        const ts = new Date(updatedAt).getTime()
        if (ts > 0 && now - ts < recentThreshold) {
          recentCount++
        }
      }

      // 我创建的
      if (currentUserId && getCreatedBy) {
        const createdBy = getCreatedBy(item)
        if (createdBy === currentUserId) mineCount++
      }

      // 已收藏
      if (getIsFavorited) {
        const isFav = getIsFavorited(item)
        if (isFav) favoritesCount++
      }
    }

    return { allCount, recentCount, mineCount, favoritesCount }
  }, [items, getUpdatedAt, getCreatedBy, getIsFavorited, currentUserId])

  // === 各 Tab 标签配置（带动态 badge 与降级处理） ===
  const tabConfig: FilterTabConfig[] = useMemo(() => {
    const hasCreatedBy = !!getCreatedBy && !!currentUserId
    const hasFavorited = !!getIsFavorited
    return ([
      { id: 'all', label: '全部', badge: counts.allCount },
      { id: 'recent', label: '最近使用', badge: counts.recentCount },
      {
        id: 'mine',
        label: '我创建的',
        badge: counts.mineCount,
        hideIfUnsupported: !hasCreatedBy,
      },
      {
        id: 'favorites',
        label: '已收藏',
        badge: counts.favoritesCount,
        hideIfUnsupported: !hasFavorited,
      },
    ] as FilterTabConfig[]).filter((t) => !t.hideIfUnsupported || t.id !== activeTab)
  }, [counts, getCreatedBy, getIsFavorited, currentUserId, activeTab])

  // === 当前 Tab 下的过滤/排序数据 ===
  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return items
      case 'recent':
        return [...items]
          .filter((item) => {
            const updatedAt = getUpdatedAt(item)
            if (!updatedAt) return false
            const ts = new Date(updatedAt).getTime()
            return ts > 0
          })
          .sort((a, b) => {
            const ta = new Date(getUpdatedAt(a) || 0).getTime()
            const tb = new Date(getUpdatedAt(b) || 0).getTime()
            return tb - ta
          })
          .slice(0, pageSize)
      case 'mine':
        if (!currentUserId || !getCreatedBy) return []
        return items.filter((item) => getCreatedBy(item) === currentUserId)
      case 'favorites':
        if (!getIsFavorited) return []
        return items.filter((item) => !!getIsFavorited(item))
      default:
        return items
    }
  }, [activeTab, items, getUpdatedAt, getCreatedBy, getIsFavorited, currentUserId, pageSize])

  return {
    activeTab,
    setActiveTab,
    filteredItems,
    tabConfig,
    currentCount: filteredItems.length,
    totalCount: items.length,
  }
}
