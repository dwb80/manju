/**
 * 剧本中心服务实现 - 向后兼容层
 *
 * 原 `script-center-impl.ts`（1886 行）已按职责拆分为 `services/script-center/` 子目录下的多个模块。
 * 本文件保留为 barrel export 入口，所有公开 API（命名导出）保持不变，
 * 已存在的 `import { ... } from "./script-center-impl.js"` 全部继续工作。
 *
 * 拆分后子模块：
 * - document-service:       剧本文档 CRUD
 * - episode-service:        剧集 CRUD
 * - scene-service:          场景 CRUD
 * - dialogue-service:       对白 CRUD
 * - scene-character-service: 场景-角色引用 CRUD
 * - scene-location-service:  场景-地点引用 CRUD
 * - template-service:       剧本模板 CRUD
 * - tag-service:            剧本标签 CRUD
 * - assessment-service:     剧本质量评估 CRUD
 * - approval-service:       剧本审批 CRUD
 * - backup-service:         剧本备份/版本服务
 * - comment-service:        剧本评论 CRUD
 * - analysis-service:       解析/统计/连续性检查/版本快照查询
 * - import-service:         剧本导入导出
 * - ai-service:             AI 剧本生成/优化/场景/对白/分镜
 * - parser:                 剧本文本解析
 * - utils:                  工具函数
 * - types:                  子模块共享类型
 */

export * from "./script-center/index.js";
