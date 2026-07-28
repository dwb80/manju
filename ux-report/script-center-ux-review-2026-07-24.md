# Script Center 目录 UX 评审报告

> 评审范围：`frontend/components/dashboard/script-center/**`（32 个文件，含 modals / hooks 子目录）
> 评审视角：UX Researcher（用户行为 + 设计决策验证 + 行动建议）
> 评审日期：2026-07-24
> 评审人：UX Researcher
> 评测方法：静态代码评审 + 组件 / 状态机 / 反馈链路审查 + WCAG 2.1 AA 可达性对齐
> 基准报告：[frontend-ux-review-2026-07-23.md](file:///d:/trae/manju/ux-report/frontend-ux-review-2026-07-23.md)

---

## 一、Executive Summary（执行摘要）

| 维度 | 评分 | 关键问题 |
|------|:---:|----------|
| 信息架构 | 4 / 5 | 编辑器 + 侧栏 + 右面板 + 模态框分工清晰，Save/Analyze hook 解耦好 |
| 一致性 | 2.5 / 5 | 反馈体系 4 套并存；emoji vs lucide 图标双轨；内联样式 20+ 处 |
| 可达性 (WCAG) | 2.5 / 5 | 多数 icon-only 按钮仅 `title` 缺 `aria-label`；emoji 图标无文字替代 |
| 反馈机制 | 2 / 5 | `window.prompt` × 4 + `console.error` × 15+ + `alert` × 0 残留 |
| 错误处理 | 2 / 5 | 与基准报告 5.3 一致：toast / notify / console 三套并行 |
| 代码健壮性 | 1.5 / 5 | **P0 BUG：BackupManager.tsx 引用未声明的 `setPendingDeleteId` 会运行时报错** |
| 可维护性 | 3.5 / 5 | 拆出 hooks / modals 子目录做得好；DetailModal 占位实现是临时债务 |

**总体结论**：Script Center 目录是项目的**编辑器核心域**，架构上（TipTap + 模块化 + hook 拆分）已达生产级。但 **运行时健壮性（BackupManager bug）、反馈一致性（4 套并行）、可达性细节（icon-only 缺 aria）** 是必须立即收口的三类问题，否则直接影响"剧本编辑 → 保存 → 备份"主流程。

---

## 二、目录地图

```
script-center/
├─ AIBubbleMenu.tsx              选区 AI 操作气泡（优化/扩写/缩写/分镜/资产）
├─ AIDiffView.tsx                AI 改写前后对比视图
├─ AIPanel.tsx                   右侧 AI 助手面板
├─ ApprovalWorkflow.tsx          审批流程（步骤/状态/评论）
├─ BackupManager.tsx             数据备份 / 恢复 / 下载 / 删除
├─ BatchImport.tsx               多文件批量导入
├─ CharacterPanel.tsx            角色资产面板（与工厂联动）
├─ ClassificationView.tsx        剧本分类视图
├─ CommentSystem.tsx             选中文本批注 + 回复树
├─ CommercialAnalysis.tsx        商业分析（受众/市场/收益/IP）
├─ ContinuityCheck.tsx           连续性检查
├─ ImportExportDialog.tsx        导入 / 导出（JSON/TXT/MD/HTML/FDX）
├─ OutlineView.tsx               大纲视图（仅读）
├─ PropPanel.tsx                 道具资产面板
├─ QuickFix.tsx                  一键修复建议
├─ ScenePanel.tsx                场景资产面板
├─ ScriptAnalysis.tsx            剧本分析
├─ ScriptEditor.tsx              TipTap 编辑器核心（含 parseDocToTree）
├─ ScriptEditRightPanel.tsx      右侧抽屉（资产 / AI / 工具 Tab）
├─ ScriptSidebar.tsx             剧集 + 场景树形导航
├─ ScriptToolbar.tsx             格式化工具栏
├─ SlashCommandMenu.tsx          / 命令菜单
├─ TagManager.tsx                标签管理
├─ TemplateLibrary.tsx           模板库（7 类目 + 预览 + 创建）
├─ VersionHistory.tsx            版本历史
├─ constants.ts                  常量
├─ useDraggable.ts               拖拽 hook
├─ hooks/
│  ├─ useScriptSave.ts           保存剧本文档 + 同步工厂
│  └─ useScriptAnalyze.ts        AI 分析
└─ modals/
   ├─ AnalyzePreviewModal.tsx    AI 分析预览
   ├─ CharacterDetailModal.tsx   角色详情（占位实现）
   ├─ DraggableModal.tsx         通用可拖拽弹窗基座
   ├─ PropDetailModal.tsx        道具详情
   ├─ SceneDetailModal.tsx       场景详情
   ├─ VersionHistoryModal.tsx    版本历史弹窗
   └─ VersionPreviewModal.tsx    版本内容预览
```

---

## 三、🚨 P0：必须立即修复

### 3.1 P0-1 [BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx) — 引用未声明的 state setter，删除备份会运行时报错

**严重度：P0 — 阻塞主流程**

**位置**：
- 引用点：[L296](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L296)、[L317](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L317)（`setPendingDeleteId` 在 onDelete 回调中）
- 渲染点：[L379-390](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L379-L390)（`{pendingDeleteId && <ConfirmDialog ... />}`）

**问题**：
组件顶部声明了 7 个 useState（L68-74），但**没有声明 `pendingDeleteId` 状态**：

```tsx
// 已声明
const [isCreating, setIsCreating] = useState(false)
const [isRestoring, setIsRestoring] = useState(false)
const [showCreateDialog, setShowCreateDialog] = useState(false)
const [backupDescription, setBackupDescription] = useState('')
const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null)
const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
const [loading, setLoading] = useState(true)

// ❌ 缺失
// const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
```

**触发路径**：用户点删除按钮 → `setPendingDeleteId(backup.id)` → `setPendingDeleteId is not a function` → 控制台报错 / 点击无反应（取决于 React 18 警告模式）

**对比**：[CommentSystem.tsx:102](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommentSystem.tsx#L102) 中有正确的 `const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)`，说明该 pattern 是从 CommentSystem 复制时漏了 state 声明。

**修复**（1 行）：
```tsx
// 在 L74 后插入
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
```

**附加**：TypeScript 编译没拦住是因为项目 `tsconfig.json` 没开 `noUnusedLocals` / `strict-mode` 全部 flags，这是个系统性盲点。建议：
1. 短期：在 `useScriptSave` / `BackupManager` 等核心组件加 Vitest 单元测试（happy path + 错误路径）
2. 中期：开启 `strictNullChecks` 严格选项

---

### 3.2 P0-2：原生 `window.prompt` 替代统一输入组件

**严重度：P0 — 违反 [frontend-ux-review-2026-07-23.md § 4.5](file:///d:/trae/manju/ux-report/frontend-ux-review-2026-07-23.md) 反馈机制原则**

**位置（共 4 处）**：

| 文件 | 行号 | 代码 |
|------|:---:|------|
| [AIBubbleMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx) | L267 | `const name = window.prompt('请输入角色名称')` |
| [AIBubbleMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx) | L286 | `const name = window.prompt('请输入场景名称')` |
| [SlashCommandMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/SlashCommandMenu.tsx) | L157 | `const url = window.prompt('请输入图片 URL')` |
| [SlashCommandMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/SlashCommandMenu.tsx) | L178 | `const url = window.prompt('请输入视频 URL')` |

**危害**（与基准报告 4.5 列举一致）：
1. **破坏视觉一致性**：原生 prompt 弹窗是浏览器默认样式（白底、黑色按钮、英文按钮），与全站暗色主题撕裂
2. **破坏国际化**：浏览器原生 prompt 不会跟随项目的 i18n 框架
3. **不可定制**：无法加 placeholder / 校验 / 输入长度限制
4. **不可测**：原生 dialog 无法用 Playwright 拦截

**修复方案**（统一使用已有基建）：
- 项目已有 `<ConfirmDialog>` 组件（基于 Radix Dialog，自动 focus trap、ESC 关闭、键盘可达）
- 但 ConfirmDialog 是二元选择，需要"输入文本"时应扩展：
  - 短期：抽出 `<PromptDialog>` 组件（基于 Radix Dialog + 单行 Input），用受控 state 管理
  - 调用方：`onSubmit={(name) => ...}` / `onCancel={() => ...}`
  - 替换 AIBubbleMenu / SlashCommandMenu 的 4 处调用

---

### 3.3 P0-3：emoji 替代 lucide-react 图标（破坏图标一致性）

**严重度：P0 — 与项目 [icons 全部从 lucide-react 引入] 原则矛盾**

**位置**：

| 文件 | 行号 | emoji | 语义 |
|------|:---:|:---:|------|
| [QuickFix.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx) | L246-252 | 🔗📝🎨📄🧠⚠️ | 连续性 / 语法 / 风格 / 格式 / 逻辑 / 兜底 |
| [TemplateLibrary.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/TemplateLibrary.tsx) | L213-232 | 🏯🏢🚀🧙💕⚡😄📝📚 | 古装 / 现代 / 科幻 / 奇幻 / 言情 / 动作 / 喜剧 / 兜底 / 全部 |
| [ClassificationView.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ClassificationView.tsx) | L39-46 | 🏛️🏙️🚀✨🔍😄💕 | 古装 / 现代 / 科幻 / 奇幻 / 悬疑 / 喜剧 / 言情 |

**危害**：
1. **不同 OS 渲染不一致**：Windows 11 显示彩色 emoji，Windows 10 / 旧 Android 显示黑白轮廓；同一用户在多端切换会看到"漂移"
2. **与全站不一致**：项目 100% 使用 lucide-react（[CharacterPanel.tsx:20](file:///d:/trae/manju/frontend/components/dashboard/script-center/CharacterPanel.tsx#L20)、[ScenePanel.tsx:17](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScenePanel.tsx#L17) 等），但这 3 个组件"开了天窗"
3. **可访问性差**：emoji 在屏幕阅读器中读出的是"link"、"page facing up"等英文，中文用户听到的是英文
4. **不可缩放**：emoji 是字体字符，缩放不跟随 theme token

**修复**：3 个文件顶部都已有 `import { ... } from 'lucide-react'`，补齐缺失的 icon：

```tsx
// QuickFix.tsx 补齐
import { Link2, Pen, Brush, FileText, Brain, AlertTriangle } from 'lucide-react'

// TemplateLibrary.tsx / ClassificationView.tsx 补齐
import { Castle, Building2, Rocket, Sparkles, Heart, Zap, Smile, BookOpen, Library } from 'lucide-react'
```

`getIssueTypeIcon` 改为返回 React 组件而非字符串，调用处 `<IconComponent className="h-4 w-4" />`。

---

## 四、⚠️ P1：下一季度体验一致性

### 4.1 P1-1：错误反馈体系分裂（与基准报告 5.3 同主题）

**全量统计**（script-center 目录内）：

| 反馈工具 | 出现次数 | 文件 |
|---|:---:|---|
| `notify.error` / `notify.warn` / `notify.success` | 5+ | [AIBubbleMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx), [QuickFix.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx), [BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx), [ScenePanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScenePanel.tsx), [PropPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/PropPanel.tsx) |
| `toast.error` / `toast.success` | 15+ | [AIBubbleMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx), [useScriptSave.ts](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts), [CommentSystem.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommentSystem.tsx) |
| `console.error` | **15+** | [BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx), [ApprovalWorkflow.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ApprovalWorkflow.tsx), [BatchImport.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BatchImport.tsx), [CommercialAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommercialAnalysis.tsx), [ContinuityCheck.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ContinuityCheck.tsx), [OutlineView.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/OutlineView.tsx), [QuickFix.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx), [ScriptAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptAnalysis.tsx) |

**问题**：
1. **同一组件内并存**：[useScriptSave.ts](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts) 同时用 `toast.error` 和 `notify.error` 的逻辑分支
2. **失败路径只 console.error**：15+ 处 `console.error('Failed to ...')` 后面**没有 toast/notify**，用户看不到任何反馈
3. **静默降级**：[BackupManager.tsx:85](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L85) 加载备份失败时只 console.error，UI 不显示错误状态
4. **进度反馈缺失**：保存 / 恢复 / 批量导入等长操作没有进度 toast（[useScriptSave.ts:83-86](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts#L83-L86) 是少数好例子，但只此一处）

**建议**（与基准报告 5.3 一致）：
- 短期：在 ESLint 加 `no-restricted-syntax` 规则禁止 `console.error` 在 `.tsx` 中直接调用
- 中期：抽象出 `useAsyncAction` hook：`const { run, loading, error } = useAsyncAction(action, { onError: notify.error, onSuccess: notify.success })`
- 长期：把项目级 `notify` 工具作为唯一反馈源，删除 `toast` 工具的重复实现

---

### 4.2 P1-2：内联样式污染设计系统（20+ 处）

**严重度：P1 — 阻碍主题切换 + 设计 token 收敛**

**统计**（`style={{ ... }}` 出现位置）：

| 文件 | 行号示例 | 用途 |
|------|----------|------|
| [AIDiffView.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIDiffView.tsx) | L115 | `style={{ left: ..., top: ... }}` 弹窗定位（合理） |
| [ApprovalWorkflow.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ApprovalWorkflow.tsx) | L296 | 颜色配置（不合理） |
| [BatchImport.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BatchImport.tsx) | L427 | 进度条（可改 token） |
| [CharacterPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CharacterPanel.tsx) | L250, L339 | 角色色块 / 网格列宽 |
| [ClassificationView.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ClassificationView.tsx) | L174 | 同上 |
| [CommercialAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommercialAnalysis.tsx) | L306, L462, L474, L486, L498, L575, L712 | **7 处**：色块、网格、宽度 — 单文件最多 |
| [OutlineView.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/OutlineView.tsx) | L135 | 间距（可改 token） |
| [PropPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/PropPanel.tsx) | L233, L251 | 道具色块 |
| [ScriptAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptAnalysis.tsx) | L167, L214, L242 | 同上 |
| [ScriptEditRightPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptEditRightPanel.tsx) | L355 | 颜色配置 |

**具体示例**（[CharacterPanel.tsx:250](file:///d:/trae/manju/frontend/components/dashboard/script-center/CharacterPanel.tsx#L250)）：

```tsx
<div style={{ backgroundColor: character.color }}>
```

**危害**：
1. **色值与 token 系统脱钩**：项目 globals.css 定义了 `--primary` `--background` 等 HSL token，但 `character.color` 是 hex 字面量（来自后端），无法跟随主题
2. **对比度不可控**：用户可能在工厂里设置了浅色背景的角色，剧本侧直接展示后无对比度保证
3. **不可维护**：未来加 dark mode / light mode 时，所有 inline style 都要扫描重写

**建议**：
- 短期：把"动态色（角色色）"的 fallback 值改用 token（如 `bg-emerald-500/30`），让边框 / 文字颜色仍走 token
- 中期：把 inline style 收敛到 `<CharacterColorBadge color={...} />` 等专用组件

---

### 4.3 P1-3：可达性 — icon-only 按钮缺 `aria-label`（仅 `title`）

**严重度：P1 — 阻塞键盘 / 屏幕阅读器用户**

**位置**（[BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx)）：

```tsx
// L481-507 三个 icon-only Button 仅有 title，缺 aria-label
<Button onClick={onDownload} title="下载备份">     // ❌
  <Download className="h-3 w-3" />
</Button>
<Button onClick={onRestore} title="恢复到此备份"> // ❌
  <RotateCcw className="h-3 w-3" />
</Button>
<Button onClick={onDelete} title="删除备份">       // ❌
  <Trash2 className="h-3 w-3" />
</Button>
```

**问题**：
- `title` 属性**只在鼠标 hover 时显示**，键盘焦点时不弹
- 屏幕阅读器（NVDA / VoiceOver）不朗读 `title`
- 唯一可访问方式是 `aria-label`（WAI-ARIA 标准）

**对比**（[DraggableModal.tsx:108](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/DraggableModal.tsx#L108) 是好例子）：
```tsx
<button onClick={handleClose} aria-label={`关闭${title}`}>
```

**建议**：所有 icon-only Button 模板统一为：
```tsx
<Button onClick={...} aria-label="下载备份" title="下载备份">
  <Download aria-hidden="true" className="h-3 w-3" />
</Button>
```

**涉及的 BackupManager 位置**：
- L174-192 标题栏"+ 创建" / 刷新按钮（有可见文字 OK）
- L227-235 标题栏"X" 关闭按钮（仅图标）
- L339-346 恢复弹窗"X" 关闭按钮
- L366-373 确认恢复按钮（有文字 OK）
- L481-507 三个操作按钮（仅图标）— **重点修复**

**其他目录内可能缺 aria-label 的位置**（建议全量扫描）：
- [ScriptSidebar.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptSidebar.tsx) 中的折叠/展开按钮
- [CharacterPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CharacterPanel.tsx) / [ScenePanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScenePanel.tsx) / [PropPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/PropPanel.tsx) 的悬浮操作按钮

---

### 4.4 P1-4：硬编码颜色 / 任意值字面量（与基准报告 3.3 同主题）

**严重度：P1 — 阻碍 light mode 引入 + token 收敛**

**典型模式**（全目录共 50+ 处）：

```tsx
className="bg-[#1a1a1a] text-white border border-white/10"
//              ↑ surface 1   ↑ text   ↑ border
className="text-[#888] text-[#666] text-[#ccc]"
//              ↑ muted text (3 种灰度，未语义化)
className="bg-[#252525]"
//              ↑ title bar 背景
```

**问题**：
- 6 种灰度值（`#666`/`#888`/`#ccc`/`#fff`/`#1a1a1a`/`#252525`/`#202020`）在 32 个文件中**重复出现**但**没有 token 命名**
- 修改一处就要 grep 全目录
- 暗色主题里 `#888` 在 `#181818` 上是 4.5:1（WCAG AA 边界），但 `#666` 是 3:1（**AA 不通过**）—— 是潜在的可读性风险

**建议**（与基准报告 3.3 一致）：
```css
/* globals.css 增补 */
--surface-1: #181818;    /* 页面背景 */
--surface-2: #1a1a1a;    /* 卡片背景 */
--surface-3: #202020;    /* 弹窗 / 抽屉 */
--surface-4: #252525;    /* 标题栏 */
--text-primary: #ffffff;
--text-secondary: #e5e5e5;
--text-muted: #a3a3a3;   /* 原 #888, 提升对比度 */
--text-disabled: #737373; /* 原 #666, 提升对比度至 4.5:1 */
```

工具链：Tailwind v3 + CSS Variables = 一次性改 `bg-surface-2` `text-muted` 即可批量更新。

---

### 4.5 P1-5：保存 / 加载状态反馈缺失

**严重度：P1 — 用户看不到进度时以为"卡死"**

**位置**：
- [BackupManager.tsx:82-88](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L82-L88) `loadBackups()` 异步过程中，UI 只会显示"加载备份列表..."
- [ApprovalWorkflow.tsx:60-85](file:///d:/trae/manju/frontend/components/dashboard/script-center/ApprovalWorkflow.tsx#L60-L85) 加载工作流无 skeleton
- [BatchImport.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BatchImport.tsx) 批量导入每行虽有 progress，但无全局"正在处理 3/10"提示
- [CommercialAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommercialAnalysis.tsx) 商业分析整页加载是空白，无 skeleton / placeholder

**对比**（[useScriptSave.ts:83-86](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts#L83-L86) 是好例子）：
```tsx
const progressId = toast.progress('正在保存剧本…', '同步剧本文档与角色 / 道具资产')
```

**建议**：
- 短期：长操作（>500ms）必须显示 progress toast 或行内 spinner
- 中期：封装 `<AsyncSection loading={...} error={...}>` 容器组件，强制每个"需要异步加载"的部分声明 loading 状态

---

### 4.6 P1-6：键盘焦点环 + 颜色 token 冲突

**严重度：P1 — 与基准报告 4.2 同主题**

**位置**：
- [BackupManager.tsx:208-218](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L208-L218) "自动备份" 开关是 `<button>` 模拟 toggle switch：
  ```tsx
  <button onClick={...} className="w-10 h-5 rounded-full ...">
  ```
  - 没有 `role="switch"` `aria-checked={autoBackupEnabled}`
  - 屏幕阅读器读出"按钮"而不是"开关"
  - 键盘可达，但语义错误

- [QuickFix.tsx:422-435](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx#L422-L435) 自定义 checkbox：
  ```tsx
  <div className="w-4 h-4 rounded border ..." onClick={...}>
  ```
  - 不是 `<input type="checkbox">`，键盘无法操作
  - 屏幕阅读器无法识别

**修复**：把模拟控件改为原生元素 + ARIA：
```tsx
// Switch
<button
  role="switch"
  aria-checked={autoBackupEnabled}
  onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
  className="..."
>
  <span aria-hidden="true" className="..." />
</button>

// Checkbox
<input
  type="checkbox"
  checked={selectedIssues.has(issue.id)}
  onChange={() => toggleIssueSelection(issue.id)}
  className="..."
/>
```

---

### 4.7 P1-7：Suspense + 懒加载未覆盖到所有重组件

**位置**：
- [DraggableModal.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/DraggableModal.tsx) 已被 [VersionHistoryModal.tsx:21-23](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/VersionHistoryModal.tsx#L21-L23) 懒加载（好例子）
- [BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx) 在 [ScriptEditRightPanel.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptEditRightPanel.tsx) 中是**直接 import**（无懒加载），BackupManager 自身 ~400 行，包含大量按钮 + 列表
- [ApprovalWorkflow.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/ApprovalWorkflow.tsx) / [CommercialAnalysis.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommercialAnalysis.tsx) / [CommentSystem.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommentSystem.tsx) 同样直接 import

**建议**：
- 短期：BackupManager / ApprovalWorkflow / CommercialAnalysis 改为 `lazy()` + `Suspense`，首屏剧本编辑器不需要这些重组件
- 中期：把 ScriptCenterIndex 中所有非编辑必须的子组件加 `lazy` 包装

---

## 五、✅ 亮点（值得保留 / 推广）

### 5.1 架构层面
- **hooks 拆分**：[useScriptSave](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts) / [useScriptAnalyze](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptAnalyze.ts) 把业务逻辑从 UI 完全剥离，便于单测
- **modals 子目录**：7 个 modal 按"一个文件一个职责"组织，每个文件头都有完整的"设计原则 / 业务说明"注释
- **基座复用**：[DraggableModal](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/DraggableModal.tsx) 是优秀范例——所有版本相关 modal 都基于它，统一拖拽 / 关闭 / 标题栏体验
- **Suspense fallback**：[VersionHistoryModal.tsx:66](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/VersionHistoryModal.tsx#L66) 给 lazy import 加了友好的 "加载中..." fallback

### 5.2 反馈机制层面
- **进度 toast**：[useScriptSave.ts:83-94](file:///d:/trae/manju/frontend/components/dashboard/script-center/hooks/useScriptSave.ts#L83-L94) 是全项目**唯一**正确使用 `toast.progress` 的例子：
  ```tsx
  const progressId = toast.progress('正在保存剧本…', '同步剧本文档与角色 / 道具资产')
  // ... 操作完成
  toast.remove(progressId)
  toast.success('剧本已保存', `已同步 ...`, 3500)
  ```
  建议把这段 pattern 抽成 `useProgressTask` hook 推广到 BackupManager / BatchImport / ApprovalWorkflow。

### 5.3 可达性层面
- **DraggableModal 的 ARIA 完整**：[DraggableModal.tsx:80-82](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/DraggableModal.tsx#L80-L82) 同时声明 `role="dialog" aria-modal="true" aria-label={title}`，是 modal 类组件的范例
- **关闭按钮的语义化 label**：[DraggableModal.tsx:108](file:///d:/trae/manju/frontend/components/dashboard/script-center/modals/DraggableModal.tsx#L108) `aria-label={\`关闭${title}\`}` 把视觉图标翻译为操作语义

### 5.4 代码细节层面
- **truncateTitle 容错**：[ScriptEditor.tsx:43-48](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptEditor.tsx#L43-L48) 30 字截断避免侧栏溢出
- **parseDocToTree 的递归设计**：[ScriptEditor.tsx:66-100](file:///d:/trae/manju/frontend/components/dashboard/script-center/ScriptEditor.tsx#L66-L100) 把 ProseMirror JSON 树形结构转为 UI 树，独立可测
- **stripOriginalPrefix 防复读**：[AIBubbleMenu.tsx:41-55](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx#L41-L55) AI 扩写时检测复读原文的常见 bug 并自动去除

---

## 六、可达性 (WCAG 2.1 AA) 审计（script-center 局部）

| 检查项 | 状态 | 备注 |
|--------|:----:|------|
| 1.4.3 文字对比度 | ⚠️ | `text-[#666]` 多次出现，对比度 < 4.5:1（见 4.4） |
| 1.4.11 非文字对比度 | ⚠️ | `border-white/10` 在 `#1a1a1a` 上偏弱 |
| 2.1.1 键盘 | ⚠️ | QuickFix 自定义 checkbox 键盘不可达（4.6） |
| 2.1.2 无键盘陷阱 | ✅ | modal 走 Radix Dialog 自动 focus trap |
| 2.4.6 标题与标签 | ⚠️ | BackupManager icon-only 按钮仅 `title` 缺 `aria-label`（4.3） |
| 2.4.7 焦点可见 | ✅ | 3px solid #38bdf8 全局 |
| 3.3.1 错误识别 | ⚠️ | 4 套反馈并存（4.1） |
| 4.1.2 角色/状态/属性 | ⚠️ | BackupManager 模拟 switch 缺 `role="switch" aria-checked`（4.6） |
| 1.4.10 重排 | 🚨 | 与全站一致：`body { min-width: 1024px }` 仍生效（继承自基准 7.2） |

---

## 七、具体修复建议（按优先级 + 工时）

### 🚨 P0 — 立即修复（本周）

| # | 行动 | 涉及文件 | 预估工时 |
|---|------|----------|:---:|
| P0-1 | **修复 BackupManager `setPendingDeleteId` 未声明 bug**（加 1 行 useState） | [BackupManager.tsx:74](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L74) | **5 min** |
| P0-2 | 替换 4 处 `window.prompt` 为新的 `<PromptDialog>` 组件 | [AIBubbleMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/AIBubbleMenu.tsx), [SlashCommandMenu.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/SlashCommandMenu.tsx) | 2h |
| P0-3 | emoji 图标全替换为 lucide-react | [QuickFix.tsx:246](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx#L246), [TemplateLibrary.tsx:213](file:///d:/trae/manju/frontend/components/dashboard/script-center/TemplateLibrary.tsx#L213), [ClassificationView.tsx:39](file:///d:/trae/manju/frontend/components/dashboard/script-center/ClassificationView.tsx#L39) | 1h |

### ⚠️ P1 — 下季度（4 周内）

| # | 行动 | 涉及文件 | 预估工时 |
|---|------|----------|:---:|
| P1-1 | 收敛 4 套反馈工具为 `notify`，加 ESLint `no-restricted-syntax` | 全目录 32 个文件 | 8h |
| P1-2 | 收敛 20+ 处内联样式到 token / 专用组件 | 见 4.2 表格 | 12h |
| P1-3 | BackupManager 等 5+ 处 icon-only 按钮加 `aria-label` | [BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx) 等 | 2h |
| P1-4 | 把 6 种灰度（#666/#888/...）收敛到 `text-muted/disabled` token | 全目录 32 个文件 | 4h |
| P1-5 | 抽出 `useAsyncAction` hook 统一 loading/error 反馈 | 新建 hook + 迁移 8 个组件 | 6h |
| P1-6 | 模拟 switch / checkbox 改为原生 + ARIA | [BackupManager.tsx:208](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx#L208), [QuickFix.tsx:422](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx#L422) | 2h |
| P1-7 | 3 个重组件加 `lazy` + `Suspense` 包装 | BackupManager / ApprovalWorkflow / CommercialAnalysis | 1h |

### 🛠 P2 — 长期（季度内）

| # | 行动 | 涉及文件 | 预估工时 |
|---|------|----------|:---:|
| P2-1 | 把 `useProgressTask` hook 抽象出来推广（参考 useScriptSave:83） | useScriptSave → 新建 hook | 4h |
| P2-2 | CharacterPanel / ScenePanel / PropPanel 统一"悬浮操作 + 卡片" 模式 | 3 文件 | 8h |
| P2-3 | 为核心 5 组件（Editor / Save / Analyze / Backup / Comment）加 Vitest 单测 | 5 文件 | 16h |
| P2-4 | 在 Playwright e2e 中加 UX 路径脚本：选中文本 → AI 改写 → 接受 → 保存 → 备份 | e2e/ | 8h |

---

## 八、引用

- 基准报告：[frontend-ux-review-2026-07-23.md](file:///d:/trae/manju/ux-report/frontend-ux-review-2026-07-23.md)
- WCAG 2.1 AA 标准：https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- Radix UI Dialog 文档：https://www.radix-ui.com/primitives/docs/components/dialog
- 项目内统一反馈工具：`@/lib/notify`
- 项目内统一确认组件：`@/components/common/confirm-dialog`
- 项目内 Toast 工具：`@/components/common/toast`（已识别为重复基建，待收敛）

**Research Evidence**: 基于 32 个文件全文阅读 + 4 处原生对话框 + 15+ 处 console.error + 20+ 处内联样式 + 1 处运行时 bug 的代码扫描。
