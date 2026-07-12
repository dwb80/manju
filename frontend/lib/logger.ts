/**
 * 模块化日志工具（Module-aware Logger）+ 客户端上报
 *
 * 设计原则：
 * - 低耦合：模块只通过 `createLogger(moduleName)` 拿到自己的 logger 实例
 * - 高内聚：所有日志输出统一格式、级别、过滤
 * - 可观测：日志自带模块名、级别、时间戳，便于在 DevTools 快速定位
 * - 可关闭：通过 localStorage 调整 `logLevel` 与 `disabledModules`
 * - 客户端上报：error / warn 级别日志批量上报到后端 /api/client-logs，便于排障
 *
 * 日志级别：debug < info < warn < error < silent
 *
 * 使用示例：
 *   const log = createLogger('script-editor')
 *   log.info('mount')
 *   log.warn('save failed', err)
 *   log.error('analyze error', err)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
}

// 默认级别：开发环境 debug，生产环境 warn
const DEFAULT_LEVEL: LogLevel =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
    ? 'warn'
    : 'debug'

// localStorage 键名（统一前缀便于识别）
const STORAGE_KEY_LEVEL = 'app:log:level'
const STORAGE_KEY_DISABLED = 'app:log:disabledModules'
const STORAGE_KEY_REPORT = 'app:log:reportDisabled'

/** 客户端上报队列。error / warn 级别入队，定时 / 阈值触发后批量 POST。 */
const REPORT_ENDPOINT = '/api/client-logs'
const REPORT_BATCH_SIZE = 10
const REPORT_FLUSH_INTERVAL_MS = 5000
const REPORT_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>(['warn', 'error'])

interface ClientLogEntry {
  level: LogLevel
  module: string
  message: string
  payload?: Record<string, unknown>
  url: string
  userAgent: string
  sessionId: string
  ts: string
}

const reportQueue: ClientLogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let sessionId = ''

/**
 * 初始化 sessionId：每浏览器会话首次进入页面分配一个 UUID。
 * 用于服务端把同一会话的客户端日志聚合起来。
 */
function ensureSessionId(): string {
  if (sessionId) return sessionId
  if (typeof window === 'undefined') {
    sessionId = 'ssr'
    return sessionId
  }
  try {
    const existing = window.sessionStorage.getItem('app:log:sessionId')
    if (existing) {
      sessionId = existing
      return sessionId
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem('app:log:sessionId', generated)
    sessionId = generated
  } catch {
    sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
  return sessionId
}

/** 是否启用了客户端上报。 */
function isReportEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY_REPORT) !== '1'
  } catch {
    return true
  }
}

/** 把 entry 入队；超过阈值或定时器到期就 flush。 */
function enqueueForReport(entry: ClientLogEntry): void {
  if (!isReportEnabled()) return
  if (typeof window === 'undefined') return
  reportQueue.push(entry)
  if (reportQueue.length >= REPORT_BATCH_SIZE) {
    void flushReportQueue()
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushReportQueue()
  }, REPORT_FLUSH_INTERVAL_MS)
}

/** 批量把队列里的日志发到后端。失败时静默丢弃（不污染业务日志）。 */
async function flushReportQueue(): Promise<void> {
  if (reportQueue.length === 0) return
  const batch = reportQueue.splice(0, reportQueue.length)
  try {
    const response = await fetch(REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ logs: batch }),
      keepalive: true,
    })
    if (!response.ok) {
      // 上报失败不再重试，避免在前端反复打日志；只 console 一次
      // eslint-disable-next-line no-console
      console.debug('[logger] client-logs report failed', response.status)
    }
  } catch {
    /* 静默：fetch 失败不影响业务 */
  }
}

/**
 * 手动 flush（页面卸载时调用一次）。
 * 浏览器可能不会等异步完成，但 keepalive 会尽量送达。
 */
export function flushClientLogs(): void {
  if (reportQueue.length === 0) return
  void flushReportQueue()
}

/**
 * 关闭客户端日志上报（保留本地 console 行为）。
 */
export function disableClientLogReport(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_REPORT, '1')
  } catch {
    /* 忽略 */
  }
}

/**
 * Logger 接口
 *
 * 每个方法接收 message 与可选 payload（payload 会被 console 同名方法打印）
 */
export interface Logger {
  debug: (message: string, ...payload: unknown[]) => void
  info: (message: string, ...payload: unknown[]) => void
  warn: (message: string, ...payload: unknown[]) => void
  error: (message: string, ...payload: unknown[]) => void
  /** 子模块 logger，会拼出 `parent/child` 形式的模块名 */
  child: (subModule: string) => Logger
}

/**
 * 从 localStorage 读取当前日志级别（仅在浏览器端生效）
 */
function readLevel(): LogLevel {
  if (typeof window === 'undefined') return DEFAULT_LEVEL
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_LEVEL) as LogLevel | null
    if (v && v in LEVEL_PRIORITY) return v
  } catch {
    /* 忽略 localStorage 读取异常 */
  }
  return DEFAULT_LEVEL
}

/**
 * 读取被禁用的模块名集合
 */
function readDisabledModules(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DISABLED)
    if (!raw) return new Set()
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

/**
 * 内部工厂：构造指定模块名的 Logger
 *
 * @param moduleName 模块名（如 'script-editor'、'script-right-panel'）
 * @param level 当前日志级别（默认从 localStorage 读取）
 * @param disabled 当前禁用模块集合
 */
function createLoggerInternal(
  moduleName: string,
  level: LogLevel,
  disabled: Set<string>
): Logger {
  const emit = (msgLevel: LogLevel, consoleFn: 'debug' | 'info' | 'warn' | 'error', message: string, payload: unknown[]) => {
    // 1) 级别过滤
    if (LEVEL_PRIORITY[msgLevel] < LEVEL_PRIORITY[level]) return
    // 2) 模块黑名单过滤
    if (disabled.has(moduleName) || disabled.has('*')) return
    // 3) 统一前缀：`[模块名][级别]` 便于 DevTools 检索
    const prefix = `[${moduleName}][${msgLevel.toUpperCase()}]`
    // eslint-disable-next-line no-console
    console[consoleFn](prefix, message, ...payload)
    // 4) error / warn 级别走客户端上报
    if (REPORT_LEVELS.has(msgLevel) && typeof window !== 'undefined') {
      enqueueForReport({
        level: msgLevel,
        module: moduleName,
        message,
        payload: serializePayload(payload),
        url: window.location?.pathname ?? '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        sessionId: ensureSessionId(),
        ts: new Date().toISOString(),
      })
    }
  }

  return {
    debug: (message, ...payload) => emit('debug', 'debug', message, payload),
    info: (message, ...payload) => emit('info', 'info', message, payload),
    warn: (message, ...payload) => emit('warn', 'warn', message, payload),
    error: (message, ...payload) => emit('error', 'error', message, payload),
    child: (subModule) =>
      createLoggerInternal(`${moduleName}/${subModule}`, level, disabled),
  }
}

/**
 * 把任意 payload 序列化成可 JSON 化的对象，去掉 Error 堆栈中的不可序列化字段。
 */
function serializePayload(items: unknown[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  items.forEach((item, index) => {
    if (item instanceof Error) {
      result[`arg${index}`] = { name: item.name, message: item.message, stack: item.stack }
    } else if (typeof item === 'object' && item !== null) {
      try {
        result[`arg${index}`] = JSON.parse(JSON.stringify(item))
      } catch {
        result[`arg${index}`] = String(item)
      }
    } else {
      result[`arg${index}`] = item
    }
  })
  return result
}

/**
 * 创建一个模块级 Logger
 *
 * @param moduleName 模块名（推荐使用小写连字符）
 * @returns Logger 实例
 */
export function createLogger(moduleName: string): Logger {
  return createLoggerInternal(moduleName, readLevel(), readDisabledModules())
}

/**
 * 调整日志级别（便于 QA 临时调整）
 */
export function setLogLevel(level: LogLevel): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_LEVEL, level)
  } catch {
    /* 忽略 */
  }
}

/**
 * 禁用指定模块的日志
 *
 * @param moduleNames 模块名数组；传 ['*'] 可禁用所有
 */
export function disableLogModules(moduleNames: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const current = Array.from(readDisabledModules())
    const merged = Array.from(new Set([...current, ...moduleNames]))
    window.localStorage.setItem(STORAGE_KEY_DISABLED, merged.join(','))
  } catch {
    /* 忽略 */
  }
}

// 浏览器卸载时尽量 flush 一次剩余日志
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushClientLogs())
  window.addEventListener('beforeunload', () => flushClientLogs())
}
