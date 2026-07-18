/**
 * notify —— 统一的用户反馈工具
 *
 * 设计动机：
 * - 现有 `toast.success` / `toast.error` 是真实"成功/失败"语义
 * - 但代码中常被借用为"提示用户某个信息"（如"请去 X 处编辑"），语义错误
 * - notify() 统一区分四种语义，让用户清楚感受到"是结果、还是指引"
 *
 * 语义对照：
 *   - notify.success：动作成功（如"保存成功"）
 *   - notify.error：  动作失败（如"网络错误"）
 *   - notify.info：   中性提示（如"请到角色工厂中编辑"），用 toast.success 占位实现
 *   - notify.warn：   警告提示（如"操作不可撤销"）
 *
 * 与 logger 的区别：
 *   - logger：开发者视角的诊断日志
 *   - notify：用户视角的反馈消息
 *
 * 使用示例：
 *   notify.info('请通过顶部"角色工厂"快捷入口管理角色资产')
 *   notify.warn('删除操作不可撤销')
 *   notify.error('保存失败：' + err.message)
 */

import { toast } from '@/components/common/toast'
import { createLogger } from './logger'

// 内部 logger：便于排查用户反馈的来源
const log = createLogger('notify')

// === 类型导出 ===
export type NotifyKind = 'success' | 'error' | 'info' | 'warn'

export interface NotifyOptions {
  /** 持续时间（毫秒），默认按类型分级：error 5s、info 3s、warn 4s、success 3s */
  duration?: number
  /** 是否同时输出到 console（默认只 error/warn 输出，info/success 静默） */
  logToConsole?: boolean
}

// === 各类型的默认持续时间 ===
const DEFAULT_DURATION: Record<NotifyKind, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
  warn: 4000,
}

// === 内部统一实现 ===
function emit(
  kind: NotifyKind,
  message: string,
  description?: string,
  options: NotifyOptions = {},
): void {
  const { duration = DEFAULT_DURATION[kind], logToConsole } = options

  // 1) 控制台输出（默认仅 error/warn，开发模式下 info 也输出）
  if (logToConsole || kind === 'error' || kind === 'warn') {
    const consoleFn = kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : 'info'
    const logMethod = consoleFn === 'error' ? 'error' : consoleFn === 'warn' ? 'warn' : 'info'
    // 把字段作为独立参数传入，避免包成对象后 DevTools 折叠显示为 `{}`
    // 之前：`[notify][ERROR] "notify.error" {}`（看不出内容）
    // 之后：`[notify][ERROR] "notify.error" "保存失败" "网络错误" 5000`
    log[logMethod](`notify.${kind}`, message, description, duration)
  }

  // 2) 转发到底层 toast
  if (kind === 'error') {
    toast.error(message, description, duration)
  } else {
    // 语义映射：info/warn/success → 全部用 success 通道展示（视觉一致）
    toast.success(message, description, duration)
  }
}

// === 公开 API ===
export const notify = {
  /** 成功反馈：动作执行成功（支持副标题，如"已同步 N 个角色"） */
  success: (message: string, description?: string, options?: NotifyOptions): void =>
    emit('success', message, description, options),

  /** 错误反馈：动作执行失败 */
  error: (message: string, description?: string, options?: NotifyOptions): void =>
    emit('error', message, description, options),

  /**
   * 中性提示：告知用户某个信息，但不代表动作成功/失败
   * 示例：notify.info('请通过顶部"角色工厂"快捷入口管理角色资产')
   */
  info: (message: string, description?: string, options?: NotifyOptions): void =>
    emit('info', message, description, options),

  /** 警告：操作可能有副作用或不可逆 */
  warn: (message: string, description?: string, options?: NotifyOptions): void =>
    emit('warn', message, description, options),
}
