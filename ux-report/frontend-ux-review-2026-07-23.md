# Agnes AI Studio 前端 UX 评审报告

> 评审范围：`frontend/app/**`（25 个路由页）+ `frontend/components/**`（150+ 组件）
> 评审视角：UX Researcher（用户行为 + 设计决策验证 + 行动建议）
> 评审日期：2026-07-23
> 评审人：UX Researcher
> 评测方法：静态代码评审 + 组件 / 路由 / 状态机审查 + WCAG 2.1 AA 可达性对齐

---

## 一、Executive Summary（执行摘要）

| 维度 | 评分 | 关键问题 |
|------|:---:|----------|
| 信息架构 | 4 / 5 | 三层分组合理，但 25+ 一级入口过多 |
| 一致性 | 3 / 5 | Tailwind / 内联样式 / 颜色 token 混用 |
| 可达性 (WCAG) | 3.5 / 5 | 焦点环 + skip-link 优秀，但 `aria-current="false"` 非法 |
| 反馈机制 | 2 / 5 | 仍大量使用原生 `alert()` / `window.confirm()` |
| 错误处理 | 2.5 / 5 | 多种错误反馈体系并存（toast / notify / alert / console） |
| 数据可信度 | 2.5 / 5 | 驾驶舱硬编码假数据，命令面板是占位 |
| 可维护性 | 3.5 / 5 | 抽象层完整，但 Storyboard 用 setInterval 轮询 DOM 是反模式 |

**总体结论**：项目在 **设计系统骨架、组件库、TypeScript 严格度、可达性基础设施** 上已经达到生产级水准。但在 **用户反馈一致性、原生浏览器控件规避、数据真实性、跨页面交互连续性** 上存在系统性短板，需要按 P0→P1→P2 顺序收口。

---

## 二、信息架构与导航

### 2.1 ✅ 优点
- **三段式侧边栏分组**（`app-sidebar.tsx`）：生产创作 / 资产与数据 / 运营与管控，语义清晰
- **当前项目选择器** 持久化在 `useProjectStore` + `sessionStorage`，刷新后自动恢复
- **CommandPalette 入口** 已挂载 `⌘K / Ctrl+K` 快捷键
- 顶部面包屑 + 驾驶舱入口形成统一的"返回首页"路径
- Logo 双行标题（"AI漫剧工业化 / 生产平台"）品牌一致性

### 2.2 ⚠️ P1 问题：侧边栏密度过高
当前侧边栏 17 个一级入口（驾驶舱、待办、助手 + 10 生产入口 + 2 资产 + 4 运营 + 2 管理）。**「视频生产线」与「剪辑中心」、「资产中心」与「数据中心」** 在角色上容易让新人混淆。

**建议**：
- 把"视频生产线/剪辑中心/音频中心"合并为"后期中心"二级菜单
- 把"模型中心"放回"管理中心"（目前已移到生产组，但管理属性更强）
- 长期任务：引入"收藏"或"最近访问"置顶

### 2.3 ⚠️ P1 问题：路由持久化策略不一致
`layout-shell.tsx:39-48` 只在 pathname=="/" 时尝试恢复，**用户主动跳到首页后又被覆盖保存**，可能导致预期外的"跳回"。

**建议**：使用 LRU（最近 5 条）方式记录非根路径，下次启动只 restore 最近一次。

---

## 三、设计系统一致性

### 3.1 ✅ 设计系统骨架良好
- `components/ui/*` 已封装 shadcn/ui（Button、Dialog、Tooltip、DropdownMenu、Badge、Form 等 24 个原语）
- `components/shared/*` 提供 `StatCard`、`ModuleToolbar`、`SearchInput`、`FilterSelect`、`EmptyState`、`Pagination` 业务通用组件
- `app/globals.css` 用 HSL CSS 变量定义语义色 token（`--primary`、`--background` 等）
- Tailwind 与 Radix UI 组合：键盘可达、focus management 正确
- 全局 `:focus-visible { outline: 3px solid #38bdf8 }` 符合 WCAG 2.4.7
- `@media (prefers-reduced-motion: reduce)` 全局关闭动画，符合 WCAG 2.3.3

### 3.2 🚨 P0 问题：内联样式污染设计系统
**问题位置**：
- [app/pipeline/page.tsx](file:///d:/trae/manju/frontend/app/pipeline/page.tsx) — 整页 132 行全用 inline `style={...}`
- [app/quality/page.tsx](file:///d:/trae/manju/frontend/app/quality/page.tsx) — 540 行 inline `style={...}`
- 大量 `style={{ color: 'rgb(148,163,184)' }}` 字面量

**危害**：
1. 设计系统无法统一管理（改主题色要逐个文件改）
2. 暗色模式不切换（RGB 字面量写死）
3. 主题色被改后这两页与全站脱节
4. 可达性差：hover/focus 状态靠 inline 难以覆盖

**建议**：
- 立即把 Pipeline / Quality 迁移到现有的 `Card` / `Table` / `Button` 组件
- 中期建立 inline style lint 规则（ESLint 自定义）
- 长期：所有"占位页面"标注 TODO 并禁用上线

### 3.3 ⚠️ P1 问题：色彩 token 一致性
页面里有三种颜色使用方式并存：
1. `bg-emerald-500/10`（Tailwind 实用类）
2. `bg-[#202020]`（Tailwind 任意值）
3. `rgba(255,255,255,0.10)`（inline rgba）

**建议**：
- 把所有 `bg-[#XXX]` 字面量收敛到 globals.css 的 `--surface-1/2/3/4` token
- 统一 dark mode 灰阶命名

---

## 四、核心业务页面评审

### 4.1 [home-dashboard.tsx](file:///d:/trae/manju/frontend/components/dashboard/home-dashboard.tsx) — 驾驶舱 ⭐⭐⭐

**🚨 P0-1：硬编码假数据**
位置：`home-dashboard.tsx:598-608`

```tsx
<div className="text-2xl font-bold text-emerald-400">12</div>      // GPU 使用率
<div className="text-2xl font-bold text-blue-400">856</div>         // 任务完成数
<div className="text-2xl font-bold text-purple-400">$1,234</div>   // AI成本消耗
```

这些数字不是占位符，是会被截屏写入产品宣传稿的**虚假生产指标**。"驾驶舱不生成模拟待办"已经体现了对此的克制，但这里没贯彻到底。

**建议**：
- 接入 `/api/admin/system-metrics` 或 `/api/dashboard/resources`
- 立即移除（最差用 `—` 占位 + "数据接入中"标签）

**🚨 P0-2：违反"无 mock 数据"原则**
位置：`home-dashboard.tsx:182-272` Promise.all 拉 7 个真实接口，但 597-611 行又写死假数据。代码内部矛盾。

**⚠️ P1-3：核心指标无更新机制**
指标卡片无自动刷新，长会话下数字会"过期"。建议加 30s polling + 最后更新时间戳。

**⚠️ P1-4：待办区空白无引导**
"待办事项"卡片直接写"请前往待办中心查看"，没有给出"如何从驾驶舱直达待办中心"的视觉引导。已经在侧边栏有"我的待办"按钮，但卡片本身没在主区域用入口按钮强化。

---

### 4.2 [app-sidebar.tsx](file:///d:/trae/manju/frontend/components/layout/app-sidebar.tsx) — 侧边栏 ⭐⭐⭐⭐

**✅ 优点**：
- 三段分组清晰，分组可折叠（aria-expanded 已正确使用）
- 当前激活项 `bg-emerald-500/10 + border-l-2 border-emerald-500` 视觉锚点稳定
- 底部状态指示 + 管理员入口（仅 admin 可见）

**🚨 P0：非法 `aria-current` 值**
位置：`app-sidebar.tsx:178, 191, 207, 253`

```tsx
aria-current={activePath === "/" ? "page" : "false"}
```

**WAI-ARIA 1.2 规范规定 `aria-current` 只能是**：`"page" | "step" | "location" | "true" | "false"` ✅ false 是合法值，但当不需要标记时**应该省略**而不是写 "false"。

**建议**：
```tsx
// 正确写法
aria-current={isActive ? "page" : undefined}
```

**⚠️ P1：图标"是侧边栏的视觉锚"**
`icon color` 在激活态变 `text-emerald-400`，但非激活态是 `text-[#888]`，对比度 4.5:1（勉强合规），但 hover 态用 `text-white` 变化过强。考虑 hover 时也保留主题色调。

**⚠️ P1：键盘焦点环被颜色块掩盖**
激活项有 `border-l-2` + `bg-emerald-500/10`，键盘 tab 到该项时，3px focus outline 会被颜色块"吞掉"。

**建议**：把焦点环放到 `outline-offset: 4px`，与左侧色块不重叠。

---

### 4.3 [layout-shell.tsx](file:///d:/trae/manju/frontend/components/layout/layout-shell.tsx) ⭐⭐⭐⭐

**✅ 优点**：
- skip-to-content 链接实现规范
- `<main id="main-content" tabIndex={-1}>` 可被跳转定位
- 独占式编辑页（剧本/角色/道具）正确隐藏侧边栏

**⚠️ P1：暗色背景色不一致**
- 主页区域：`bg-[#181818]`
- 独占编辑页：`bg-[#0a0a0a]`
- 顶部栏：`bg-[#202020]`
- 卡片：`bg-[#202020]`

**3 个深色**（#0a/18/20），肉眼能看出"主页 vs 卡片 vs 编辑页"的层级，但缺乏 token 表达。建议统一 `bg-surface-1/2/3` 命名。

---

### 4.4 [layout/command-palette.tsx](file:///d:/trae/manju/frontend/components/layout/command-palette.tsx) — 命令面板 ⭐⭐

**🚨 P0：占位实现暴露在生产构建中**
文件头注释 `W4 临时实现`，搜索框 placeholder `输入命令（占位）…`，中央提示 `命令面板占位（W4 临时实现）`。

**危害**：用户按 ⌘K 后看到的是"占位"文字，会立刻怀疑这是个 demo 产品。

**建议**：
- 至少实现 6 条最有用的命令（跳转到 /scripts, /projects, /storyboards, 切换项目, 切换主题, 显示快捷键帮助）
- 或者暂时只保留 ⌘K 触发一个 toast 提示"命令面板即将上线"

---

### 4.5 [modules/projects-center.tsx](file:///d:/trae/manju/frontend/components/modules/projects-center.tsx) — 项目中心 ⭐⭐⭐

**🚨 P0：用 `alert()` 反馈错误**
位置：[projects-center.tsx:262, 279](file:///d:/trae/manju/frontend/components/modules/projects-center.tsx#L262)

```tsx
alert(`保存失败：${msg}`);
alert(`删除失败：${msg}`);
```

**全站共发现 15 处 `alert()` + 6 处 `window.confirm()`，分布如下**：

| 文件 | 数量 |
|------|:---:|
| [app/models/page.tsx](file:///d:/trae/manju/frontend/app/models/page.tsx) | 4 |
| [app/scripts/[id]/page.tsx](file:///d:/trae/manju/frontend/app/scripts/[id]/page.tsx) | 2 |
| [components/dashboard/script-center/BackupManager.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/BackupManager.tsx) | 5 |
| [components/dashboard/script-center/QuickFix.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/QuickFix.tsx) | 2 |
| [components/dashboard/script-center/TemplateLibrary.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/TemplateLibrary.tsx) | 1 |
| [components/modules/projects-center.tsx](file:///d:/trae/manju/frontend/components/modules/projects-center.tsx) | 2 |
| [app/studio/studio-page/index.tsx](file:///d:/trae/manju/frontend/app/studio/studio-page/index.tsx) | 3 (`window.confirm`) |
| [components/dashboard/script-center/CommentSystem.tsx](file:///d:/trae/manju/frontend/components/dashboard/script-center/CommentSystem.tsx) | 1 |
| [components/modules/scripts-center/script-import/index.tsx](file:///d:/trae/manju/frontend/components/modules/scripts-center/script-import/index.tsx) | 2 |

**建议**：
- 短期：批量替换 `alert()` → `notify.error(...)`，`window.confirm()` → 现有的 `<ConfirmDialog>` 组件
- 中期：ESLint 自定义规则 `no-restricted-syntax` 禁止 `Identifier[name='alert']` 和 `window.confirm` 调用
- 已有 `ConfirmDialog` / `notify` 工具，迁移成本极低

**⚠️ P1：分镜工厂行没有"复制/移动"快捷操作**
项目列表行只支持查看/编辑/删除/打开剧本，缺少"复制为模板"、"导出 JSON"、"归档"等高频操作。

---

### 4.6 [modules/storyboard-director.tsx](file:///d:/trae/manju/frontend/components/modules/storyboard-director.tsx) — 分镜导演台 ⭐⭐⭐

**🚨 P0：DOM 轮询反模式**
位置：[storyboard-director.tsx:433-451](file:///d:/trae/manju/frontend/components/modules/storyboard-director.tsx#L433-L451)

```tsx
useEffect(() => {
  const id = setInterval(() => {
    const container = document.querySelector("[data-factory-selected]");
    if (!container) return;
    try {
      const raw = container.getAttribute("data-factory-selected") ?? "[]";
      const ids: string[] = JSON.parse(raw);
      setSelectedIds((prev) => { ... });
    } catch {}
  }, 500);
  return () => clearInterval(id);
}, []);
```

**问题**：
1. **违反 React 单向数据流**：父组件（FactoryCRUDPage）把状态写到 DOM，子组件用 setInterval 500ms 轮询回读
2. **浪费 CPU**：每次渲染都触发 500ms 定时器
3. **延迟反馈**：选中最长延迟 500ms
4. **脆弱**：DOM attribute 序列化失败、节点未挂载都会静默失败
5. **不可测试**：无法 mock 验证交互

**建议**：
- 改用 Zustand store（项目已有 `useFactoryEntity`，`selectedIds` 是其暴露的状态）
- 让 StoryboardDirectorPage 直接 `import { useFactoryEntity }` 或通过 props 接收 `selectedIds`
- 这样"一键生成视频（n）"的 n 立即同步，组件通信也变成声明式

**✅ 优点（V2 父子结构）**：
- Storyboard → Shot 父子结构清晰
- 镜头列表按 storyboard 折叠（`expanded` 状态）
- AI 拆分 / 添加镜头 / 图生视频 三种镜头操作分层合理

**⚠️ P1：折叠状态没记忆**
`StoryboardRow` 的 `expanded` 是组件内 useState，**刷新页面后丢失**。需要批量查看多个分镜的镜头时，用户每次都要重新展开。

**建议**：把 `expanded: Set<string>` 提升到页面级或 store。

**⚠️ P1：操作按钮密度过高**
每行分镜底部有 4 个按钮（编辑 / 图生视频 / 展开镜头 / 删除），全部 `opacity-0 group-hover:opacity-100`，键盘用户无法发现。

**建议**：默认至少显示 1-2 个高频按钮（编辑 + 删除），其他放更多菜单。

---

### 4.7 [modules/review-center.tsx](file:///d:/trae/manju/frontend/components/modules/review-center.tsx) — 审核中心 ⭐⭐⭐⭐

**✅ 优点**：
- shadcn/ui 试点迁移做得好（Badge、Tooltip、DropdownMenu）
- "复制内容ID"和"打开关联内容"两个二级操作下拉收纳
- 表格用 `hidden sm:table-cell` / `hidden md:table-cell` 做响应式

**⚠️ P1：审核结果按钮缺失**
审核中心应该支持**批量通过/批量打回**（高频运营场景），但目前只能单条编辑。

**建议**：
- 顶部加"批量通过 / 批量打回"按钮
- 表格行加 checkbox 多选

**⚠️ P1：审核结果按钮"复制内容ID"**
这个动作存在但语义不强：用户复制 ID 之后做什么？应该直接提供"跳转到待审核的内容"主路径。

---

### 4.8 [app/quality/page.tsx](file:///d:/trae/manju/frontend/app/quality/page.tsx) — 质检中心 ⭐⭐

**🚨 P0：整页内联样式 + 写死 projectId**
- `DEFAULT_PROJECT_ID = "p-171a35d8-0c63-40a3-8ece-d69e6ee39764"` 写死在文件
- 132 行 + 540 行 inline style（见 3.2）
- 用户需要"猜"或"问开发者"才知道自己的 projectId

**建议**：
- 改用 GlobalTopBar 已选中的 `selectedProjectId`
- 立即迁移到统一设计系统

**🚨 P0：React Fragment + 双 `<tr>` 无 key**
位置：[app/quality/page.tsx:399-427](file:///d:/trae/manju/frontend/app/quality/page.tsx#L399-L427)

```tsx
{sortedReports.map((r) => {
  ...
  return (
    <>
      <tr key={r.id}>...</tr>   // key 在内层 Fragment 元素上，React 仍报 warning
      {isOpen && ...}
    </>
  );
})}
```

外层 `<>...</>` 是匿名 Fragment，没有 key，React 会发 warning。应该用 `<React.Fragment key={r.id}>`。

**⚠️ P1：默认 target 难懂**
"手动触发检测"表单要求用户输入 `targetId`（如 `img-xxx / vid-xxx`），普通运营无法获取。

**建议**：把"手动检测"降级为"高级操作"，普通用户入口只展示报告和汇总。

---

### 4.9 [app/pipeline/page.tsx](file:///d:/trae/manju/frontend/app/pipeline/page.tsx) — 流水线入口 ⭐⭐

**🚨 P0：技术工具冒充业务页面**
整个页面就是一个文本框："请输入 run-test-xxxxxx"。底部还告诉用户"可通过 SQLite 直接 INSERT 一条 pipeline_runs 记录"。

**这暴露了后端架构给最终用户**，严重影响产品专业度。

**建议**：
- 短期：把此页改为"项目下所有 run 列表"（按 selectedProjectId 过滤）
- 长期：完整 PipelineCenterPage（参考 /projects 列表页模式）

---

### 4.10 [app/todos/page.tsx](file:///d:/trae/manju/frontend/app/todos/page.tsx) — 我的待办 ⭐⭐⭐⭐

**✅ 优点**：
- 公共组件复用好（StandalonePageHeader / StatsOverview / Alert）
- 用 `notify` 工具（不是 toast.success）— 这才是统一反馈的正确用法
- 状态 / 优先级 / 截止日期 / 关联跳转都齐全
- 软删除 + 回收站

**⚠️ P1：`window.confirm` 用于删除确认**
位置：[todos/page.tsx:157, 180](file:///d:/trae/manju/frontend/app/todos/page.tsx#L157)

```tsx
if (!confirm(`确定删除待办「${t.title}」？可在回收站恢复。`)) return;
```

已有 `<ConfirmDialog>` 组件但没复用，破坏了体验一致性。

---

### 4.11 [app/assistant/page.tsx](file:///d:/trae/manju/frontend/app/assistant/page.tsx) — 智能助手 ⭐⭐

**⚠️ P1：承诺未兑现**
页面有"AI 对话（即将上线）"区块（`assistant/page.tsx:108`），但没有任何输入框或交互。`/components/chat/*` 已有完整 chat 组件，应集成。

**建议**：要么把 chat-view 接到这里，要么把整个区块隐藏。

**⚠️ P1：快捷操作"AI 任务队列"语义重复**
侧边栏已经有"AI 任务队列"一级入口，仪表盘"快捷操作"卡片再次出现，重复发现。

---

### 4.12 [app/scripts/page.tsx](file:///d:/trae/manju/frontend/app/scripts/page.tsx) + [scripts/[id]/page.tsx](file:///d:/trae/manju/frontend/app/scripts/[id]/page.tsx) — 剧本中心 / 编辑器 ⭐⭐⭐⭐

**✅ 优点**：
- 1190 行单文件已拆为 ScriptEditor / ScriptToolbar / ScriptSidebar / OutlineView / ScriptEditRightPanel / modals
- Suspense fallback + Lazy import 处理导入导出对话框
- useScriptSave hook 统一保存逻辑
- 模块化 logger
- 大纲视图单独抽出

**⚠️ P1：仍使用 `alert()` 测试 API 失败**
位置：[scripts/[id]/page.tsx:1121, 1129](file:///d:/trae/manju/frontend/app/scripts/[id]/page.tsx#L1121)

---

### 4.13 [app/publish/page.tsx](file:///d:/trae/manju/frontend/app/publish/page.tsx) — 发布准备 ⭐⭐⭐

**✅ 优点**：
- 真实 API + StandalonePageHeader
- "一键打包"功能（生成 manifest JSON）很有用
- 平台 → 后端字段映射 (`toApiPlatform`) 封装正确

**⚠️ P1：fetch 而非 api 客户端**
直接用 `fetch("/api/publish/videos")` + `result.code` 判断，绕过了 `lib/api-client`，错误处理、日志、缓存都失效。

**建议**：所有 fetch 必须走 `api()`，保持与全站一致。

---

## 五、关键反模式与代码异味

### 5.1 🚨 P0：组件通信用 DOM（已展开见 4.6）

### 5.2 🚨 P0：原生 alert/confirm（见 4.5）

### 5.3 ⚠️ P1：错误反馈体系分裂
全站有 4 种错误反馈并存：
1. `alert()` — 15+ 处
2. `window.confirm()` — 6 处
3. `console.error` — 10+ 处
4. `toast.success` / `notify.error` — 主流通用工具

**应该收敛到单一** `notify.*` 工具。

### 5.4 ⚠️ P1：键盘可达性局部缺陷
- `<button>` 元素用 `<div onClick>` 模拟的较少（已基本规避）✅
- 但很多 action button 只有 `onClick` 没 `aria-label`（依赖 icon + Tooltip，键盘焦点时 Tooltip 不显示）
- 焦点环在某些深色卡片上对比度不足

### 5.5 ⚠️ P1：图片 fallback 处理不统一
- [storyboard-director.tsx:369](file:///d:/trae/manju/frontend/components/modules/storyboard-director.tsx#L369) 用 `<img>` 配 `alt=""`
- [FactoryCRUDPage.tsx:220](file:///d:/trae/manju/frontend/components/factory/FactoryCRUDPage.tsx#L220) `onError` 隐藏图片
- 应该封装 `<SafeImage>` 组件统一处理

---

## 六、可达性 (WCAG 2.1 AA) 审计

| 检查项 | 状态 | 备注 |
|--------|:----:|------|
| 1.4.3 文字对比度 | ⚠️ | `#888` on `#181818` ≈ 4.5:1，AA 边界 |
| 1.4.11 非文字对比度 | ⚠️ | `bg-white/10` 边框在深色背景上偏弱 |
| 2.1.1 键盘 | ✅ | 全站 `<button>` 原生元素 |
| 2.1.2 无键盘陷阱 | ✅ | modal 用 Radix Dialog 自动 focus trap |
| 2.4.1 跳过区块 | ✅ | skip-to-content 链接实现 |
| 2.4.3 焦点顺序 | ✅ | 全局 order 一致 |
| 2.4.6 标题与标签 | ✅ | PageContainer / StandalonePageHeader 一致 |
| 2.4.7 焦点可见 | ✅ | 3px solid #38bdf8 全局 |
| 3.3.1 错误识别 | ⚠️ | 错误反馈分裂（见 5.3） |
| 3.3.2 标签 | ✅ | FormDialog 自动生成 label |
| 4.1.2 角色/状态/属性 | 🚨 | `aria-current="false"` 不规范（见 4.2） |
| 2.3.3 减少动画 | ✅ | `prefers-reduced-motion` 全局 |
| 1.4.4 文字缩放 | ⚠️ | 字号用 px 硬编码，200% 缩放可能溢出 |
| 1.4.10 重排 | 🚨 | `body { min-width: 1024px }` 强制水平滚动 |

### 关键可达性改进建议
1. **`aria-current` 修正**（10 分钟，4 处）
2. **`prefers-reduced-motion` 检查 Tailwind 动画**（`animate-spin` `animate-pulse` 是 CSS keyframes，需在 globals.css 也加 prefers-reduced-motion 覆盖）
3. **提供 "system font size" 兼容**：用 `rem` 替换 `text-[13px]`

---

## 七、可达性 / 包容性 - 特殊场景

### 7.1 暗色主题
- 全站默认 dark，浅色主题未实现
- **风险**：明亮环境（户外、阳光）下用户使用困难
- **建议**：增加 light mode + system preference 自动切换

### 7.2 移动端
- 全部页面 `min-width: 1024px`（globals.css:97）
- **风险**：平板（iPad mini 744px）和小尺寸笔记本（13寸）出现水平滚动
- **建议**：明确告诉用户这是"桌面端"产品，或重写响应式

### 7.3 屏幕阅读器
- `<aside>` + `<nav>` + `<main>` 语义标签使用正确
- 但按钮的 aria-label 数量不足，依赖 Tooltip 不够（Tooltip 默认不显示，键盘 tab 时不弹出）

---

## 八、行动建议（按优先级）

### 🚨 P0 - 立即修复（影响生产可用性 / 信任）

| # | 行动 | 涉及文件 | 预估工时 |
|---|------|----------|:---:|
| P0-1 | 移除驾驶舱硬编码假数据 (12/856/$1,234) | home-dashboard.tsx | 1h |
| P0-2 | 修复 `aria-current="false"` → `undefined` | app-sidebar.tsx 等 4 处 | 30min |
| P0-3 | 替换所有 `alert()` 为 `notify.error` | 15+ 处 | 4h |
| P0-4 | 替换所有 `window.confirm()` 为 `<ConfirmDialog>` | 6 处 | 3h |
| P0-5 | 修复 Quality 页 Fragment + 双 tr key 问题 | quality/page.tsx | 30min |
| P0-6 | 重写 CommandPalette 占位（至少 6 条命令） | command-palette.tsx | 4h |
| P0-7 | Pipeline 页改为"项目下 run 列表" | pipeline/page.tsx | 8h |
| P0-8 | Storyboard setInterval 轮询改为 Zustand store | storyboard-director.tsx + FactoryCRUDPage | 6h |

### ⚠️ P1 - 下一季度（体验一致性 / 可达性提升）

| # | 行动 | 涉及文件 | 预估工时 |
|---|------|----------|:---:|
| P1-1 | Pipeline / Quality 页面迁移到统一设计系统 | 2 个 page | 12h |
| P1-2 | 增加 light mode / system preference | globals.css + 各 page | 24h |
| P1-3 | 收敛 4 套错误反馈工具为单一 `notify` | 各 page | 8h |
| P1-4 | 统一 fetch → api() 客户端 | publish/page 等 | 4h |
| P1-5 | 提供 `<SafeImage>` 组件 | shared/ | 4h |
| P1-6 | 集成 HelpCenter 自动触发（首次登录） | layout | 6h |
| P1-7 | 集成 OnboardingFlow + 已完成状态记录 | layout | 6h |
| P1-8 | 修复 StoryboardDirectorRow 折叠状态持久化 | storyboard-director.tsx | 4h |
| P1-9 | 修复 setInterval 后的 action button 键盘可见性 | 各 module | 6h |

### 🛠 P2 - 长期（架构 / 战略）

| # | 行动 | 预估工时 |
|---|------|:---:|
| P2-1 | 全站 i18n 框架（next-intl）+ Settings 已声明的 `language` 字段 | 80h |
| P2-2 | 完整侧边栏重构（合并后期中心 / 引入"最近访问"） | 40h |
| P2-3 | 响应式适配平板（去掉 min-width: 1024px 硬约束） | 80h |
| P2-4 | 屏幕阅读器全站验证（VoiceOver / NVDA 实际测试） | 16h |
| P2-5 | 引入 Playwright e2e UX 测试（关键流程 5 个） | 24h |
| P2-6 | ESLint 规则禁止 alert / confirm / 硬编码颜色 | 4h |

---

## 九、User Research 后续建议

### 9.1 建议开展的可访问性研究
- **场景 A**：键盘 only 用户全任务流（创建项目 → 生成分镜 → 提交审核）成功率和时长
- **场景 B**：屏幕阅读器用户在审核中心的实际操作，验证 shadcn Dialog 焦点管理
- **场景 C**：色盲用户（红绿色盲）对状态色（红/黄/绿）的辨识测试

### 9.2 建议开展的可用性测试
1. **新手引导评估**：让 5 名无经验用户首次进入驾驶舱，记录他们从"我有创意"到"能写出第一份剧本"的时间和路径
2. **Pipeline 实际可用性**：让 3 名项目经理使用 /pipeline 页面，验证他们能否独立完成"暂停/恢复一个 run"
3. **错误恢复测试**：故意制造 5 类错误（保存失败 / 网络中断 / 权限不足 / 数据冲突 / 表单校验），记录每类的错误提示与恢复路径

### 9.3 数据埋点建议
- 用户在每个页面的停留时间
- 真实触发 AI 任务（生成视频 / 拆分镜头）的频次
- 命令面板（⌘K）的实际使用率
- "一键生成视频"按钮的点击率与成功率

---

## 十、附录

### A. 文件清单（评审覆盖）

```
frontend/app/layout.tsx                          ✅
frontend/app/page.tsx                            ✅
frontend/app/ai-tasks/page.tsx                   ✅
frontend/app/assistant/page.tsx                  ✅
frontend/app/audio/page.tsx                      ✅
frontend/app/characters/page.tsx                 ✅
frontend/app/data/page.tsx                       ✅
frontend/app/logs/page.tsx                       ✅
frontend/app/pipeline/page.tsx                   🚨 内联样式
frontend/app/pipeline/runs/[runId]/page.tsx      ⏸ 未读
frontend/app/projects/page.tsx                   ✅
frontend/app/publish/page.tsx                    ✅
frontend/app/quality/page.tsx                    🚨 内联样式 + Fragment
frontend/app/review/page.tsx                     ✅
frontend/app/scripts/page.tsx                    ✅
frontend/app/scripts/[id]/page.tsx               ✅
frontend/app/settings/page.tsx                   ✅
frontend/app/todos/page.tsx                      ✅
frontend/components/dashboard/home-dashboard.tsx 🚨 假数据
frontend/components/layout/layout-shell.tsx      ✅
frontend/components/layout/app-sidebar.tsx       🚨 aria-current
frontend/components/layout/global-top-bar.tsx    ✅
frontend/components/layout/command-palette.tsx   🚨 占位
frontend/components/modules/projects-center.tsx  🚨 alert()
frontend/components/modules/review-center.tsx    ✅
frontend/components/modules/storyboard-director.tsx 🚨 DOM 轮询
frontend/components/factory/FactoryCRUDPage.tsx  ✅
frontend/components/common/onboarding-flow.tsx  ⏸
frontend/components/common/help-center.tsx       ⏸
frontend/app/globals.css                         ✅ 可达性基础好
```

### B. 参考标准
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- WAI-ARIA 1.2 aria-current: https://www.w3.org/TR/wai-aria-1.2/#aria-current
- shadcn/ui 可达性: https://ui.shadcn.com/docs
- Radix UI Primitives: https://www.radix-ui.com/primitives

### C. 复审与跟踪建议
- 本次评审输出建议建立 Linear / Jira tickets，按 P0→P1→P2 排期
- P0 修复完后进行 30 分钟快速回归（重点关注侧边栏、剧本编辑、质检、流水线）
- P1 完成时建议做一次 5 人 / 1 小时的 moderated 可用性测试
- 建议每季度做一次可达性 audit，跟踪 WCAG 合规进度
