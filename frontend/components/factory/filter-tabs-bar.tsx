'use client'

/**
 * FilterTabsBar —— 工厂页通用筛选 Tabs
 *
 * 设计动机（评审 P1-工厂页加 tab）：
 * - 工厂页"全部 / 最近使用 / 我创建的 / 已收藏"切换需要统一的 UI
 * - 抽到本组件后，三个工厂共享样式
 *
 * 设计原则：
 * - 单一职责：仅负责 Tab 切换的展示
 * - 可配置：tabConfig 由 useFilterState 动态生成
 * - 可访问：role="tab" / aria-selected
 *
 * 使用示例：
 *   <FilterTabsBar
 *     tabs={tabConfig}
 *     activeTab={activeTab}
 *     onChange={setActiveTab}
 *   />
 */

import { cn } from '@/lib/utils'
import { createLogger } from '@/lib/logger'
import type { FilterTabConfig, FilterTabId } from '@/hooks/use-filter-state'

// 模块级 logger
const log = createLogger('filter-tabs-bar')

export interface FilterTabsBarProps {
  /** Tab 配置（来自 useFilterState） */
  tabs: FilterTabConfig[]
  /** 当前激活 Tab */
  activeTab: FilterTabId
  /** Tab 切换回调 */
  onChange: (tab: FilterTabId) => void
  /** 容器 className（可选） */
  className?: string
}

/**
 * FilterTabsBar - 工厂页通用筛选 Tabs 组件
 * @description 工厂页的"全部/最近使用/我创建的/已收藏"切换 Tabs，由 useFilterState 驱动
 * @param {FilterTabConfig[]} tabs - Tab 配置列表（来自 useFilterState）
 * @param {FilterTabId} activeTab - 当前激活的 Tab ID
 * @param {(tab: FilterTabId) => void} onChange - Tab 切换回调
 * @param {string} [className] - 容器 className
 * @returns {JSX.Element} 渲染的筛选 Tabs 组件
 */
export function FilterTabsBar({ tabs, activeTab, onChange, className = '' }: FilterTabsBarProps) {
  const handleClick = (tab: FilterTabConfig) => {
    log.debug('click', { id: tab.id, label: tab.label })
    onChange(tab.id)
  }

  return (
    <div
      role="tablist"
      aria-label="筛选维度"
      className={cn(
        'flex items-center gap-1 border-b border-white/10 overflow-x-auto',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleClick(tab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px',
              isActive
                ? 'text-emerald-400 border-emerald-500'
                : 'text-[#888] border-transparent hover:text-white hover:border-white/20',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/10 text-[#888]',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
