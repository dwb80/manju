// Script Center Components
// 剧本中心组件集合
//
// 模块化原则：
// - 每个子模块（编辑器/侧栏/面板/弹窗）独立文件，便于按需引入
// - 公共常量与类型集中在 ./constants，跨模块共享
// - 弹窗集中在 ./modals，统一使用 DraggableModal 基座
//
// 评审变更记录：
// - v2：移除右侧"场景" Tab，ScenePanel 不再从此入口导出（保留文件供 ScriptSidebar 等其他模块使用）

export { ScriptEditor } from './ScriptEditor'
export type { NavTreeNode } from './ScriptEditor'
export { ScriptToolbar } from './ScriptToolbar'
export { ScriptSidebar } from './ScriptSidebar'
export { CharacterPanel } from './CharacterPanel'
// ScenePanel 仍可通过 `./ScenePanel` 直接 import（供 ScriptSidebar 等模块使用）
// 此处不导出，避免其他模块误用为右侧面板
export { PropPanel } from './PropPanel'
export { AIPanel } from './AIPanel'
export { AIBubbleMenu } from './AIBubbleMenu'
export { AIDiffView } from './AIDiffView'
export { SlashCommandMenu } from './SlashCommandMenu'
export { VersionHistory } from './VersionHistory'
export { ImportExportDialog } from './ImportExportDialog'

// === 评审优化新增 ===
// 右侧面板（已移除"场景" Tab；面板内容渲染收敛到组件内部）
export { ScriptEditRightPanel } from './ScriptEditRightPanel'
export type { ScriptEditRightPanelProps } from './ScriptEditRightPanel'

// 弹窗基座与具体弹窗
export { DraggableModal } from './modals/DraggableModal'
export { VersionHistoryModal } from './modals/VersionHistoryModal'
export { VersionPreviewModal } from './modals/VersionPreviewModal'
export { AnalyzePreviewModal } from './modals/AnalyzePreviewModal'
export type { AnalyzePreviewData, AnalyzePreviewModalProps } from './modals/AnalyzePreviewModal'

// 公共常量
export {
  RIGHT_PANEL_TABS,
  RIGHT_PANEL_TAB_CONFIG,
  FACTORY_SHORTCUT_URLS,
  DEFAULT_RIGHT_PANEL_TAB,
} from './constants'
export type { RightPanelTab } from './constants'

// P1 功能组件
export { OutlineView } from './OutlineView'
export { ScriptAnalysis } from './ScriptAnalysis'
export { ContinuityCheck } from './ContinuityCheck'
export { TagManager } from './TagManager'
export { ClassificationView } from './ClassificationView'
export { ApprovalWorkflow } from './ApprovalWorkflow'

// P2 扩展功能组件
export { CommentSystem } from './CommentSystem'
export { CommercialAnalysis } from './CommercialAnalysis'
export { QuickFix } from './QuickFix'
export { BatchImport } from './BatchImport'
export { TemplateLibrary } from './TemplateLibrary'
export { BackupManager } from './BackupManager'