# UI 覆盖度及需求—页面—状态追溯评审（2026-07-29）

> **评审对象**：31 个产品模块、47 个交付功能、UI 设计规范、`frontend/app` 路由、核心组件和现有 E2E 证据  
> **评审类型**：设计/源码静态追溯评审；未把页面存在视为功能已交付，也未替代真实浏览器视觉回归与可用性测试  
> **结论**：**No-Go（不能认定 UI 已完整满足需求）**。信息架构和主要 CRUD 页面可继续迭代，但工业化生产所需的状态闭环仍存在 P0 缺口。

## 1. 执行摘要

- 前端存在 34 个 Next.js `page.tsx` 路由页面。
- 31 个产品模块中，20 个有明确且基本对应的页面，9 个只有组合/局部页面，2 个没有对应页面。
- 按“能找到某个入口”计算为 29/31；按“模块职责和关键状态均有独立、明确承载”计算仅 20/31。
- 现有 E2E 规格约 91 个 `test()`，覆盖若干主路由和 CRUD 主路径，但未形成 31 模块 × 标准状态的追溯矩阵。
- `frontend/app` 中未发现路由级 `loading.tsx`、`error.tsx`、`not-found.tsx`。
- 源码未检出 QC Intake 的 `qc_running / qc_blocked / review_pending`、DEP 新鲜度/影响预评估、编辑租约/在线协作等关键 UI 状态。

因此当前 UI 更接近“主要模块页面和局部交互已具备”，不能证明“需求、页面、状态、权限、异常和恢复已全部闭环”。

## 2. 模块—页面覆盖矩阵

状态：**覆盖**＝有明确页面承载主要职责；**部分**＝依附其他页面、模型陈旧或关键状态缺失；**缺失**＝未找到产品入口。

| # | 模块 | 当前入口 | 覆盖 | 主要缺口 |
|---:|---|---|---|---|
| 01 | 驾驶舱 | `/` | 覆盖 | 仍需 DEP/风险真实投影证据 |
| 02 | 我的待办 | `/todos` | 覆盖 | 需与 WorkItem 权威模型核对 |
| 03 | 通知中心 | — | 缺失 | 无通知列表、偏好、去重/升级状态页 |
| 04 | 项目中心 | `/projects` | 覆盖 | — |
| 05 | 剧本中心 | `/scripts`、`/scripts/[id]` | 覆盖 | 旧审核流仍需收敛 |
| 06 | 分镜板 | `/storyboards` | 部分 | 与导演台混合，缺明确 Storyboard/Shot 层级导航 |
| 07 | 分镜导演台 | `/storyboards` | 覆盖 | 缺专业构图/连续性完整状态证据 |
| 08 | 角色工厂 | `/characters` | 覆盖 | — |
| 09 | 场景工厂 | `/scenes` | 覆盖 | — |
| 10 | 道具工厂 | `/props` | 覆盖 | — |
| 11 | 资产中心 | `/assets` | 覆盖 | — |
| 12 | AI 图片生成 | `/assistant?mode=image`、`/images/[id]` | 部分 | 缺 Shot 绑定和候选树完整工作台 |
| 13 | AI 视频生成/生产线 | `/video-production`、`/videos/[id]` | 覆盖 | — |
| 14 | AI 任务队列 | `/ai-tasks` | 覆盖 | — |
| 15 | 模型中心 | `/models` | 覆盖 | — |
| 16 | 流水线模板中心 | `/pipeline` | 覆盖 | Run 详情已有，模板/版本职责需再核验 |
| 17 | Prompt 中心 | — | 缺失 | 无 PromptTemplate 列表、版本、发布/归档页面 |
| 18 | 数据中心 | `/data` | 覆盖 | — |
| 19 | 项目预算与成本 | `/data` 等组合视图 | 部分 | 无预算策略、预占、审批和超限处置专属流程 |
| 20 | 审核中心 | `/review` | 部分 | 无 QC Intake 子状态、个人队列和完整版本对比证据 |
| 21 | 质检中心 | `/quality` | 部分 | 无送审门禁/豁免/mandatory 阻断交互 |
| 22 | 音频中心 | `/audio` | 覆盖 | — |
| 23 | 剪辑中心 | `/clips` | 部分 | 当前 Clip UI 尚未证明对齐新 Timeline/Revision 模型 |
| 24 | 发布准备 | `/publish` | 覆盖 | — |
| 25 | AI 对话/创意工作室 | `/assistant`、`/studio` | 覆盖 | 两入口职责需保持清晰 |
| 26 | 项目工作台 | `/projects/workbench` | 覆盖 | — |
| 27 | 系统用户与权限 | `/settings` 局部 | 部分 | 主要仍是 admin/非 admin，缺项目角色和命令级能力解释 |
| 28 | 系统设置 | `/settings` | 覆盖 | — |
| 29 | 系统日志与审计 | `/logs` | 覆盖 | — |
| 30 | 回收站与数据恢复 | 各模块局部回收站 | 部分 | 无跨对象 RecoveryItem、保留任务和恢复作业中心 |
| 31 | 导入导出与备份 | 剧本/项目局部入口 | 部分 | 无统一 ImportJob/ExportJob/BackupJob 状态中心 |

## 3. 页面状态覆盖审计

交付基线要求页面至少明确 `loading / empty / ready / forbidden / conflict / error`，长任务还要覆盖 queued、running、cancelling、completed、failed、cancelled、timed_out、unknown_result。

| 状态 | 当前证据 | 判定 |
|---|---|---|
| loading | 多个组件有局部 spinner/loading flag | 部分；无路由级 loading boundary |
| empty | 工厂、资产、审核、音频、待办等存在 EmptyState | 较好，但未逐模块追溯 |
| ready | 所有主要页面均有正常态 | 覆盖 |
| forbidden/read-only | 主要见模型、设置及少量审核逻辑 | 不完整；未按 11 角色/命令矩阵覆盖 |
| conflict | 主要在剧本编辑器发现冲突语义 | 严重不足；Shot、资产、EditProject 未形成统一冲突 UI |
| error/retry | 多为 toast 或局部 catch | 不完整；缺稳定错误页、保留用户输入和可操作恢复 |
| not-found/deleted/stale | 无路由 boundary；少量缺失数据提示 | 不完整 |
| QC Intake | 未检出 `qc_running/qc_blocked/review_pending` | 缺失 |
| DEP freshness/impact | 未检出生产依赖新鲜度与影响预评估 UI | 缺失 |
| collaboration lease/presence | 未检出租约、在线成员或接管交互 | 缺失 |
| async terminal states | AI task 页面有部分状态 | 尚未证明所有长任务一致覆盖 |

## 4. P0 问题

### UI-P0-001：QC→Review 门禁没有页面状态模型

送审后 UI 需要展示 `qc_running → qc_blocked | review_pending → reviewing`，并处理自动重试、阻断规则、warn 豁免、mandatory 禁止豁免和新版本重新质检。当前审核/质检页面及源码未检出这些状态，无法承载 H-003 的领域流程。

**关闭条件**：为 Shot 与 FinalVideo 送审建立统一 Intake 组件和状态图；增加通过、阻断、合法豁免、禁止豁免、超时耗尽及版本变化六类 E2E。

### UI-P0-002：生产依赖变化对用户不可见

未检出 DEP 新鲜度、下游影响范围、旧审核失效或修复计划 UI。上游剧本/资产/分镜变化后，用户无法可靠判断哪些候选、审核、剪辑和成片已过期。

**关闭条件**：所有版本化写操作前提供影响预评估；页面持续显示 `current/stale/blocked/unknown` 和证据；提供受控重跑/重审计划且不能直接编辑派生状态。

### UI-P0-003：多人协作、权限和冲突没有形成系统状态

当前权限 UI 主要表现为管理员与只读判断；未检出编辑租约、在线成员、强制接管、`expectedVersion` 冲突比较和项目业务角色对应的能力解释。

**关闭条件**：按命令级 RBAC 生成页面动作权限；为 Script/Shot/资产/EditProject 加入 lease/presence/conflict/takeover 状态和审计提示；至少覆盖无权限、租约占用、版本冲突、代理到期四类 E2E。

### UI-P0-004：标准页面状态没有逐功能追溯

虽然局部组件存在 loading/empty/toast，但不存在 47 功能 × 标准状态矩阵，且没有路由级 loading/error/not-found boundary。错误恢复往往只显示 toast，不能证明用户输入、筛选和编辑上下文得到保留。

**关闭条件**：测试矩阵增加 `pageRoutes`、`uiStates`、`roleVariants`；每个 P0/P1 功能至少覆盖 loading、empty、ready、forbidden、conflict、error/retry 中适用项并说明不适用理由。

## 5. P1 问题

1. **通知中心和 Prompt 中心缺页**：补齐列表、详情、版本/偏好、权限和异常状态。
2. **恢复与导入导出缺统一作业中心**：当前分散入口不能展示跨对象依赖、保留期、后台任务、失败重试和审计。
3. **剪辑 UI 尚未证明对齐 Timeline 新模型**：需覆盖多轨、来源版本、Transition/Effect 版本、修订冲突和渲染预检。
4. **设计资料存在版本漂移**：历史 UI Review 已指出原型导航、强调色和设计规范版本不一致；应声明唯一生效版本并归档过时原型。
5. **可访问性自动化不足**：存在 skip link 和部分 aria，但测试中未发现 axe 等系统化扫描；键盘、焦点、对比度和屏幕阅读器尚不能判定通过。

## 6. 准入结论

| 工作范围 | 结论 |
|---|---|
| 继续完善 DDD、交付规格和 UI 信息架构 | Go |
| 三工厂、基础列表和已具备页面的局部开发 | Conditional Go，需按标准状态补验收 |
| 审核质量送审链、多人协作、DEP 变更链 | No-Go，先关闭对应 P0 |
| 声明“UI 设计已全部覆盖需求、可直接全面开发” | No-Go |

## 7. 推荐执行顺序

1. 先设计 QC Intake 和 DEP 影响两条跨页面主链。
2. 建立 47 功能 × route × role × state × scenario 的机器可读 UI 追溯矩阵。
3. 落地权限、租约、冲突与恢复的共享组件。
4. 补通知中心、Prompt 中心及统一后台作业中心。
5. 对齐新 Timeline 并补剪辑工作台原型与场景。
6. 运行真实浏览器视觉回归、axe、键盘流和最低分辨率测试，证据入库后再复评。

