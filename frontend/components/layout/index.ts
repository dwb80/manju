/**
 * Layout 公共组件统一出口
 *
 * 模块化原则：
 * - 所有 layout 相关的公共组件（页面头/统计卡/提示条）都从此处导出
 * - 业务页仅需 `import { StandalonePageHeader, StatsOverview, Alert } from '@/components/layout'`
 *
 * 评审优化记录：
 * - v2 (P0)：新增 StandalonePageHeader / StatsOverview / Alert 三个公共组件
 *   替换 /ai-tasks /models /data /publish 等独立页面的重复 header/stats/alert 样式
 */

export { PageContainer, PageCard, PageDivider } from './page-container'
export { StandalonePageHeader } from './standalone-page-header'
export type {
  StandalonePageHeaderProps,
} from './standalone-page-header'

export { StatsOverview } from './stats-overview'
export type {
  StatsCardConfig,
  StatsCardTone,
  StatsOverviewProps,
} from './stats-overview'

export { Alert } from './alert'
export type { AlertProps, AlertTone } from './alert'

export { AppSidebar } from './app-sidebar'
export { ErrorBoundary } from './error-boundary'
export { LayoutShell } from './layout-shell'
