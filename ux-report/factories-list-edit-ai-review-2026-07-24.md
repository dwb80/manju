# 三个工厂（角色 / 场景 / 道具）"列表页 / 编辑页 / 生成图片"与旧版差异分析与修复方案

> 范围：`/characters` `/scenes` `/props` 三个工厂模块
> 评审视角：Lead PM + 前端架构师（结合 `git log` 跨版本对比 + 现行代码 + `docs/` 文档 + 项目记忆）
> 评审日期：2026-07-24
> 基准报告：[`ux-report/frontend-ux-review-2026-07-23.md`](ux-report/frontend-ux-review-2026-07-23.md)、[`ux-report/script-center-ux-review-2026-07-24.md`](ux-report/script-center-ux-review-2026-07-24.md)
> 涉及代码（新版）：
> - [`frontend/components/factory/FactoryCRUDPage.tsx`](frontend/components/factory/FactoryCRUDPage.tsx)（1231 行）
> - [`frontend/components/factory/useFactoryEntity.ts`](frontend/components/factory/useFactoryEntity.ts)
> - [`frontend/components/factory/types.ts`](frontend/components/factory/types.ts)
> - [`frontend/components/factory/index.ts`](frontend/components/factory/index.ts)
> - [`frontend/components/factory/UsageDialog.tsx`](frontend/components/factory/UsageDialog.tsx)
> - [`frontend/components/factory/filter-tabs-bar.tsx`](frontend/components/factory/filter-tabs-bar.tsx)
> - [`frontend/components/factory/parts/`](frontend/components/factory/parts)（5 个部件）
> - [`frontend/components/shared/ai-generate-dialog.tsx`](frontend/components/shared/ai-generate-dialog.tsx)
> - [`frontend/components/modules/character-factory.tsx`](frontend/components/modules/character-factory.tsx)（536 行）
> - [`frontend/components/modules/scene-factory.tsx`](frontend/components/modules/scene-factory.tsx)
> - [`frontend/components/modules/prop-factory.tsx`](frontend/components/modules/prop-factory.tsx)
> - [`frontend/app/characters/page.tsx`](frontend/app/characters/page.tsx)、[`/scenes/page.tsx`](frontend/app/scenes/page.tsx)、[`/props/page.tsx`](frontend/app/props/page.tsx)
> - [`frontend/app/characters/[id]/edit/page.tsx`](./frontend/app/characters/[id]/edit/page.tsx)（独立编辑页）

---

## 一、Executive Summary（执行摘要）

| 维度 | 评分 | 关键问题 |
|------|:---:|----------|
| 列表页可用性 | 4 / 5 | 通用 `FactoryCRUDPage` 工作正常；UI 与之前大体一致 |
| 编辑页体验 | 3 / 5 | 角色图片生成被拆到独立路由 `/characters/[id]/edit`，但场景/道具仍使用 `window.open` 跳到占位页；新旧两套交互并存 |
| AI 生成图片 | 2.5 / 5 | 与 [`images.txt`](images.txt) 文档严重不符：模型名、size、ratio、response_format 全部走自定义，未与 Agnes Image 2.1 Flash 规范对齐 |
| 架构 | 2.5 / 5 | 上一版（`e798a57~1`）已经拆好的 `useFactoryActions` / `useRecycleBin` / `parts/factory-*` 被回退为单体 1231 行文件，与 7-23 UX 评审"P1-7 拆 hooks"建议相悖 |
| 文档一致性 | 1.5 / 5 | 旧版功能文档（[`docs/requirements/modules/06-asset-library.md`](docs/requirements/modules/06-asset-library.md) 角色/场景字段 5 项）与新版 AI 扩展 17 字段不匹配，文档与代码漂移 |
| 数据所有权 | 2 / 5 | 工具栏"全选"与各 factory 卡片自己实现的"checkbox 浮窗"重复；selectedIds 既写入本地 state 又写入 `useFactorySelectionStore`，无收敛协议 |

**总体结论**：三个工厂的"列表页 + 编辑页 + AI 生图"在最近一次重构里发生了**三处主要变化**：(1) 角色编辑从模态弹窗改为独立路由，(2) AI 生成对话框与 `images.txt` 文档脱节，(3) 上一版已经拆好的 FactoryCRUDPage 子模块被回退为单体。**P0 集中在 AI 生图与文档/契约不一致**，会导致按 docs 写的 prompt 与实际生成结果不一致（用户感知最明显），并埋下数据漂移隐患。

---

## 二、新旧版本核心差异（git 对照）

### 2.1 FactoryCRUDPage 拆解被回退（架构逆行）

| 维度 | 旧版（`e798a57~1`） | 新版（`8fd519b` HEAD） | 差异 |
|------|-------------------|----------------------|------|
| 文件行数 | ~280 行（容器） + 8 个 parts + 3 个 hooks | **1231 行**（单体） | **+940%** |
| 数据加载 | `useFactoryEntity(fetchList)` 单参 | `useFactoryEntity(entityType ?? entityLabel, fetchList)` 双参 | 增加 `entityType` 隔离 store key |
| 业务操作 | `useFactoryActions` hook | 直接在组件里 `useCallback` 11 个 `handle*` | hook 拆分被回退 |
| 回收站 | `useRecycleBin` hook | 组件内 useState + useEffect | hook 拆分被回退 |
| 视图拆分 | `parts/factory-view-tabs.tsx` `parts/factory-normal-view.tsx` `parts/factory-recycle-bin-view.tsx` `parts/factory-dialogs.tsx` 4 个部件 | **0 个**（全部内联） | 拆分完全回退 |
| Hydration 守卫 | 通过 `useFactoryActions` 内部封装 | 直接调用 `useHasMounted()` | 行为一致但封装层级下降 |
| `factory-selection-store` 同步 | 通过 hook | 通过 `useFactoryEntity` 内部 useEffect | 行为一致 |
| `filterTabs` 入口 | 接入 | **保留** | OK |
| `enableTemplates` | 接入 | **保留** | OK |
| `fetchVersions` | 接入 | **保留** | OK |

**结论**：上一版（`e798a57`）已经按"评审优化"路线把 FactoryCRUDPage 拆成 8 个 parts + 3 个 hooks。本次（`8fd519b` v2.1.0 release commit）把容器回退到 1231 行单体。

> ⚠️ 项目记忆明确："Stream C W0 schema freeze 原则" / "Repository 注入模式" 都要求"低耦合可单测"，但 FactoryCRUDPage 现在的 11 个 `handle*` 全部在组件内部 useCallback，**无法独立单测**。

### 2.2 角色编辑入口变化（从"内联弹窗"到"独立路由"）

| 维度 | 旧版 | 新版 | 评价 |
|------|------|------|------|
| 入口 | 模态弹窗（`CharacterImageGenerator`） | 新标签页 `/characters/[id]/edit` | ✅ 工业感更强（独立 URL、可分享） |
| 提示词 | 三列布局（侧栏/参数/预览） | 简化为两列（左输入 / 右预览） | ⚠️ 损失"风格 / 数量" 等参数控制 |
| 生图参数 | 与 `images.txt` 文档完全一致 | **不符合 `images.txt`** | 🚨 见 §3 |
| 场景/道具 | 类比角色（应有独立路由） | **仍调用 `window.open('/scenes/[id]/edit')` / `/props/[id]/edit`**，但路由**未实现** | 🚨 跳转即 404 |
| 关闭行为 | 关闭弹窗 | `window.close()` + `router.push("/characters")` 回退 | ✅ 双保险 |
| 错误处理 | toast 反馈 | inline `generateError` state | ⚠️ 错误反馈只在右栏显示，不易发现 |

**结论**：只有角色工厂完成了"弹窗 → 独立路由"改造；场景/道具工厂的编辑页路径**没有真正落地**。

### 2.3 AI 生成对话框（`AIGenerateImageDialog`）参数漂移

**`images.txt` 文档规定的接口参数**（Agnes Image 2.1 Flash 规范）：

```text
model: "agnes-image-2.1-flash"        // 必填
prompt: string                        // 必填
size: "1024x768"                      // 必填
image: string[]                       // 图生图必填
return_base64: boolean                // 文生图 Base64 输出
extra_body.response_format: "url|b64_json"  // 不在顶层
```

**新版 `ai-generate-dialog.tsx` 实际请求**：

```text
prompt: "<prompt>, <style>风格"      // 拼接
n: 1~4                                // 多张候选
size: "1024x1024"                     // 固定 1024×1024 ❌ 文档示例 1024x768
response_format: "url"                // 顶层 ❌ 文档要求放 extra_body
```

**3 处与 `images.txt` 文档不一致**：

1. **缺少 `model: "agnes-image-2.1-flash"`** — 文档明确要求传 model，新版完全没传
2. **`size: "1024x1024"`** — 文档示例用 `1024x768`（4:3 横向）/ `1024x1024` 仅是方形，新版强制方形
3. **`response_format` 写在请求体顶层** — 文档明确警告"请勿在请求体顶层放置 `response_format`"，需要 `extra_body.response_format: "url"`

> 角色独立编辑页 [`/characters/[id]/edit/page.tsx`](./frontend/app/characters/[id]/edit/page.tsx#L102-L112) 走的是另一条 API 路径 `/api/images/generate`，**与 `ai-generate-dialog` 行为完全不同**。两套逻辑：
> - 编辑页：`size: "768x1152"` + `ratio: "9:16"`（9:16 竖屏）
> - AI 生成对话框：`size: "1024x1024"`（固定方形）
>
> 同一个"角色工厂"对"生图"行为不一致——这是 UX 一致性问题。

### 2.4 三个工厂的 AI 扩展字段（新增 17 字段）

旧版（`e798a57~1`）AI 生成对话框只接受 2 个额外字段（description、traits）。新版扩到 17 字段：

| 工厂 | 旧版额外字段数 | 新版额外字段数 | 新增字段 |
|------|:---:|:---:|----------|
| 角色 | 2 | **17** | identity, face, hair, body, temperament, costume_name/description/color/material/style, accessories, first_appearance, dialogue_count, generation_prompt, confidence |
| 场景 | — | **16** | category, indoor_outdoor, location, architecture, terrain, plants, objects, period, tone, visual_style, atmosphere_emotion, suitable_shots, reusable_elements, ... |
| 道具 | — | **11** | appearance, material, size, color, importance_level, owner, shape, texture, story_function, visual_features, camera_usage, ... |

**结论**：字段是按"AI 剧本分析扩展字段"要求加的，**功能上有价值**（配合 AI 剧本分析模块自动填表），但：
- 表单字段也同步加了 17 项（characterFields 从 7 → **24**），新建/编辑对话框滚动很长
- [`docs/requirements/modules/06-asset-library.md`](docs/requirements/modules/06-asset-library.md) 仍然写"角色特征、风格关键词"5 字段版本
- [`docs/requirements/01-product-design-spec.md`](docs/requirements/01-product-design-spec.md) §3.4 描述"角色资产包含：基础设定、参考图、Prompt、LoRA、三视图、表情库、动作库"——**没有 costume_* 等字段**
- 文档与代码完全漂移

### 2.5 选中状态的双重实现（潜在 bug 风险）

新版 FactoryCRUDPage 中：

```tsx
// useFactoryEntity.ts:85-89
useEffect(() => {
  useFactorySelectionStore.getState().setSelection(entityType, selectedProjectId, selectedIds);
}, [entityType, selectedProjectId, selectedIds]);
```

+ 各 factory 卡片自己实现的"checkbox 浮窗"（如 `character-factory.tsx:209-225`）：

```tsx
<button onClick={(e) => { e.stopPropagation(); actions.onToggleSelect(); }} ...>
```

**潜在问题**：
- `actions.onToggleSelect` 来自 FactoryCRUDPage 注入 → 修改 `setSelectedIds` → 触发 `useFactoryEntity` 的 useEffect → 写入 store
- 卡片内部用 `actions.selected` 读取，但 `selected` 也是从 FactoryCRUDPage 传入的 `selectedIds.has(item.id)` 计算出来的派生值
- **如果 `entityType` 在 FactoryCRUDPage 内部取值不稳定**（line 301: `entityType ?? entityLabel`），store key 会跳变
- 例如：角色工厂没传 `entityType`，回退到 `"角色"` 中文；场景工厂回退到 `"场景"`，但实际有 `entityType: "scene"` 也有传 → store key 不一致

**实际触发场景**：用户在 A 工厂选中 5 项资产 → 切到 B 工厂 → 切回 A → selection 被清空（line 79-81 切换项目时清空），但 store 里残留旧 key。**在 Stream A/D 评测里没复现 bug，可能是没测**。

### 2.6 顶部 Tabs "正常 / 回收站" 切换 UX 问题

新版 `activeView: "normal" | "recycleBin"` 切换（line 306-308）：

```tsx
<button onClick={switchToNormal}>正常{entityLabel}（{items.length}）</button>
<button onClick={switchToRecycleBin}>回收站（{deletedItems.length}）</button>
```

**问题**：
- `deletedItems.length` 不会自动刷新：只有进入"回收站" Tab 才触发 `reloadRecycleBin`（line 321-327 useEffect 依赖 `activeView`）
- 切回"正常"再切回"回收站"**会重复加载**（没有缓存机制）
- `clearApiCache()` 是在删除/恢复时清缓存的，但 `reloadRecycleBin` 自身没清
- 计数 `{deletedItems.length}` 在切回"正常"后仍展示旧数字——视觉上误导用户"回收站还有 N 项"实际是过期数据

---

## 三、P0：必须立即修复

### 3.1 🚨 P0-1：场景/道具工厂的"编辑"按钮跳转 404

**严重度：P0 — 阻塞主流程**

**位置**：
- [`scene-factory.tsx:179-185`](frontend/components/modules/scene-factory.tsx#L179-L185) `handleEdit = () => window.open('/scenes/${id}/edit')`
- [`prop-factory.tsx:189-196`](frontend/components/modules/prop-factory.tsx#L189-L196) `handleEdit = () => window.open('/props/${id}/edit')`

**路由现状**：
- ✅ [`app/characters/[id]/edit/page.tsx`](./frontend/app/characters/[id]/edit/page.tsx) — 完整实现
- ❌ `app/scenes/[id]/edit/page.tsx` — **不存在**（LS 结果只有 `consistency-pack/`）
- ❌ `app/props/[id]/edit/page.tsx` — **不存在**（LS 结果只有 `consistency-pack/`）

**触发路径**：用户点场景/道具卡片的"编辑"按钮 → 打开新标签页 → 路由 404

**修复方案**（3 选 1，推荐 A）：
- **A. 复用角色编辑页模板**（推荐）：抽 `app/[entityType]/[id]/edit/page.tsx`（dynamic route），根据 `entityType` 复用同一份编辑器，传 `entityType: "scene" | "prop"` 作为 prop
- **B. 退回到旧版模态弹窗**：恢复 `CharacterImageGenerator` 的场景/道具版本（用 window.dimensions 不同 + 共享 `ImageGeneratorParams`）
- **C. 直接禁用按钮**：在 scene-factory.tsx / prop-factory.tsx 编辑按钮上 `disabled={true}` + tooltip "场景/道具编辑页即将上线"——但这违反"先实现再发布"原则

**附加**：建议 A 方案把编辑器抽到 `components/factory/EntityImageEditor.tsx`，三个工厂共用。

### 3.2 🚨 P0-2：AI 生成对话框与 `images.txt` 文档脱节

**严重度：P0 — 契约不一致**

**位置**：[`ai-generate-dialog.tsx:175-183`](frontend/components/shared/ai-generate-dialog.tsx#L175-L183)

**当前代码**：
```ts
const task = await api<ImageTask>("/api/images/generate", {
  method: "POST",
  body: JSON.stringify({
    prompt: style ? `${trimmedPrompt}, ${style}风格` : trimmedPrompt,
    n,
    size: "1024x1024",                  // ❌ 写死方形
    response_format: "url",              // ❌ 应在 extra_body
    // ❌ 缺 model: "agnes-image-2.1-flash"
  }),
});
```

**应改为**（按 [`images.txt`](images.txt) §"文生图：URL 输出"）：
```ts
body: JSON.stringify({
  model: "agnes-image-2.1-flash",                       // ✅ 必填
  prompt: style ? `${trimmedPrompt}, ${style}风格` : trimmedPrompt,
  size: "1024x768",                                     // ✅ 默认 4:3 横向（与文档示例一致）
  n,                                                     // ✅ Agnes 也支持 n
  extra_body: {
    response_format: "url",                              // ✅ 按文档要求放 extra_body
  },
}),
```

**注意**：需要先确认后端 `/api/images/generate` 是否接受 `extra_body.response_format`。如不支持，需在后端 `ai-client-factory.ts` 添加映射。

**附加修复**：3 选 1（统一参数来源）
- **A. 把"生图默认参数"抽到 `frontend/lib/image-config.ts`**，三个工厂都引用同一份：
  ```ts
  export const DEFAULT_IMAGE_PARAMS = {
    model: "agnes-image-2.1-flash",
    size: "1024x768",
    ratio: "4:3",
    n: 4,
    extra_body: { response_format: "url" as const },
  } as const;
  ```
- **B. 让后端 API 接受 `aspectRatio` 字段**，由后端按 `images.txt` 规范组装请求
- **C. 强制要求 `images.txt` 是单一真相源**，后端 / 前端 / 文档全部对齐

### 3.3 🚨 P0-3：编辑页与 AI 生成对话框 size 不一致

**严重度：P0 — 同一"角色工厂"生图行为分裂**

**对比**：

| 入口 | 模型 | size | ratio | response_format |
|------|------|------|-------|-----------------|
| 角色卡片 → 编辑 | agnes-image-2.1-flash | **768x1152** | **9:16** | 顶层 url |
| 角色卡片 → AI 生成 | **缺** | **1024x1024** | 1:1 | 顶层 url |

**影响**：用户对"角色 X"的图片期望，前后两次可能完全是不同构图（9:16 竖屏 vs 1:1 方形），且候选图（4 张 vs 1 张）行为不同。

**修复**：
1. 立刻统一为 `1024x768`（4:3）+ 4 张候选
2. 长期：在 `DEFAULT_IMAGE_PARAMS` 中按"实体类型"区分 size（character: 9:16，scene: 16:9，prop: 1:1）—— 这与项目常识一致

### 3.4 🚨 P0-4：选中状态 store key 不稳定（潜在 bug）

**严重度：P0 — 跨工厂选择隔离可能失效**

**位置**：[`useFactoryEntity.ts:46`](frontend/components/factory/useFactoryEntity.ts#L46) + [`FactoryCRUDPage.tsx:301`](frontend/components/factory/FactoryCRUDPage.tsx#L301)

```ts
// useFactoryEntity.ts
useFactorySelectionStore.getState().setSelection(entityType, selectedProjectId, selectedIds);

// FactoryCRUDPage.tsx
const { ... } = useFactoryEntity(
  entityType ?? entityLabel,  // entityType 没传时回退到中文 "角色"
  fetchList,
);
```

**问题**：
- `character-factory.tsx` 没传 `entityType` → store key = "角色"
- 但 `props/[id]/page.tsx` 之类的其他文件如果引用 `useFactoryEntity("character")` → store key = "character"
- 跨 store key 隔离会失效

**修复**：
1. `FactoryCRUDPageProps` 把 `entityType` 改为**必填**（不是可选）
2. 在 `types.ts:124-125` 把 `entityType?: FactoryEntityType` 改为 `entityType: FactoryEntityType`
3. 三个工厂 `config` 都加上 `entityType: "character"` / `"scene"` / `"prop"`

---

## 四、P1：下一季度一致性

### 4.1 P1-1：恢复 FactoryCRUDPage 的模块化拆分

**严重度：P1 — 阻碍单测 + 增大 PR 冲突面**

**位置**：[`FactoryCRUDPage.tsx` 全文 1231 行](frontend/components/factory/FactoryCRUDPage.tsx)

**建议拆分**（与旧版 `e798a57~1` 对齐）：

```text
components/factory/
├─ FactoryCRUDPage.tsx          # 容器 ~200 行
├─ useFactoryEntity.ts          # 数据加载（已存在）
├─ useFactoryActions.ts         # 11 个 handle* 业务操作
├─ useRecycleBin.ts             # 回收站数据
├─ useSelectionSync.ts          # factory-selection-store 同步
├─ UsageDialog.tsx              # 已存在
├─ filter-tabs-bar.tsx          # 已存在
└─ parts/
   ├─ batch-change-type-menu.tsx        # 已存在
   ├─ factory-batch-actions-bar.tsx     # 已存在
   ├─ select-all-row.tsx                # 已存在
   ├─ recycle-bin-row.tsx               # 已存在
   ├─ entity-type-from-label.ts         # 已存在
   ├─ factory-view-tabs.tsx             # 新建
   ├─ factory-normal-view.tsx           # 新建
   ├─ factory-recycle-bin-view.tsx      # 新建
   └─ factory-dialogs.tsx               # 新建
```

**好处**：
- 每个文件 < 200 行，可独立单测
- 11 个 `handle*` 改写到 `useFactoryActions` 后，可对 `useFactoryActions` 加 vitest 单测
- 减少 PR 冲突面

### 4.2 P1-2：回收站计数实时刷新

**严重度：P1 — 计数过期误导用户**

**位置**：[`FactoryCRUDPage.tsx:321-327`](frontend/components/factory/FactoryCRUDPage.tsx#L321-L327)

**问题**：删除 / 恢复时 `setDeletedItems` 已更新，但 `items`（正常视图的列表）没有同步更新——如果用户在"回收站" Tab 看到的是 `{deletedItems.length} = 5` 但正常列表已经少了 5 个，**用户预期是删除即时反馈，但实际要切回正常 Tab 才能看到。**

**修复**：
- 删除时同步更新 `items`（乐观更新）：
  ```ts
  const handleDeleteConfirm = useCallback(async () => {
    // ... 现有代码
    // 乐观更新
    setItems((prev) => prev.filter((it) => it.id !== target.id));
    // ... 然后调用 API
  });
  ```
- 永久删除时同步从两个列表移除（已部分实现，见 line 712-714）

### 4.3 P1-3：hydrate 守卫与 loadingView 重复

**严重度：P1 — 重复逻辑 + UX 不一致**

**位置**：
- `FactoryCRUDPage.tsx:721-723` 顶层 `!hasMounted && <div>加载中…</div>`
- `FactoryCRUDPage.tsx:863-864` 内部 `isLoading && loadingView` 是另一个加载态

**问题**：
- 两个 loading 状态同时存在，用户可能看到"加载中…"闪两次
- `loadingView` 只在 factory 自己传了才生效（prop-factory.tsx:413-415 传了，但 character/scene 没传）——不一致

**修复**：合并为一个 `<AsyncSection loading={isLoading || !hasMounted}>` 容器组件

### 4.4 P1-4：候选图默认只显示 1 张，但 4 张拼接 prompt 与 `images.txt` 不符

**严重度：P1 — 文生图 n 参数文档约束**

**位置**：[`ai-generate-dialog.tsx:174`](frontend/components/shared/ai-generate-dialog.tsx#L174)

```ts
const n = Math.max(1, Math.min(4, Number(count) || 4));
```

`images.txt` 文档未明确给出 `n` 的范围（实际上 Agnes Image 2.1 Flash 默认 n=1）。建议：
- `n` 范围与文档对齐
- 在 `extra_body.n` 传递，而不是顶层
- 给用户一个明确的 "n=1~4 张候选" 提示

### 4.5 P1-5：inline 样式 + 内联 emoji 残留

**严重度：P1 — 阻碍 light mode 主题切换**

**位置**：
- 三个 factory 的卡片全部用 `style={{ backgroundColor: ... }}` 配 `inline rgba`
- `ai-generate-dialog.tsx:228` 等多处 `style={{ left, top }}` 弹窗定位
- `FactoryCRUDPage.tsx:61` `bg-[#202020]` 字面量

**修复**：纳入 UX 评审 §3.3 token 收敛计划。

### 4.6 P1-6：AI 生成对话框"创建中..."按钮文案与 character-factory.tsx 的 "创建成功" 不一致

**严重度：P1 — 反馈文案飘忽**

**对比**：

| 位置 | 文案 |
|------|------|
| `ai-generate-dialog.tsx:461` | "创建中..." |
| `character-factory.tsx:619` | "创建成功" |
| `scene-factory.tsx` AI 部分 | (无 toast) |
| `prop-factory.tsx` AI 部分 | (无 toast) |

`scene-factory.tsx` 和 `prop-factory.tsx` 的 `aiConfig.onGenerate` 只调用 `createScene` / `createProp`，**没有 toast 成功反馈**。

**修复**：在 FactoryCRUDPage 的 `handleAIGenerateConfirm` 统一负责成功 toast（line 619 已经做了），但需要确认 scene / prop 也走这条路——查看 `FactoryCRUDPage.tsx:610-625` 实际是统一调用的，scene/prop 的 onGenerate 只是返回 `await createScene(...)` 不返回 toast，由父组件统一成功 toast。✅ 这点实际是统一的，**问题不成立**。

**真实问题**：`ai-generate-dialog.tsx` 自身在 catch 时调 `toast.error`（line 201），父组件 `handleAIGenerateConfirm` 失败时只 `setIsAIGenerating(false)` 不 toast——**错误反馈是双层的，可能会重复 toast**。

**修复**：去掉 `ai-generate-dialog.tsx:201` 的 `toast.error`，让父组件统一 toast 错误。

### 4.7 P1-7：`AIGenerateImageDialog` 缺 `LazyImage` 与 `Skeleton`

**严重度：P1 — 4 张候选图同时加载慢**

**位置**：[`ai-generate-dialog.tsx:337-372`](frontend/components/shared/ai-generate-dialog.tsx#L337-L372)

**问题**：4 张 1024×1024 图片同时加载，首屏白屏 + LCP 慢

**修复**：
- 用 `loading="lazy"` 标签
- 占位用 skeleton
- 或者：逐张加载（先 1 张 → 选中后异步加载剩余 3 张）

### 4.8 P1-8：三个工厂的卡片悬浮按钮 `opacity-0 group-hover:opacity-100` 不支持键盘

**严重度：P1 — 键盘可达性**

**位置**：[`character-factory.tsx:302`](frontend/components/modules/character-factory.tsx#L302) / [`scene-factory.tsx:258`](frontend/components/modules/scene-factory.tsx#L258) / [`prop-factory.tsx:269`](frontend/components/modules/prop-factory.tsx#L269)

**与 UX 评审 §4.6 一致**：键盘 tab 不到悬浮按钮。修复方案同基准报告。

### 4.9 P1-9：AI 扩展字段（17 字段）表单滚动 3 屏

**严重度：P1 — UX 差**

**位置**：[`character-factory.tsx:89-135`](frontend/components/modules/character-factory.tsx#L89-L135) `characterFields` 24 项 / [`scene-factory.tsx:85-120`](frontend/components/modules/scene-factory.tsx#L85-L120) 21 项 / [`prop-factory.tsx:91-126`](frontend/components/modules/prop-factory.tsx#L91-L126) 18 项

**问题**：新建角色对话框滚动 3 屏，核心字段（name、role、image）藏在最上面 5 个里。

**修复**：
- 把字段分组（"基础信息" / "外貌与服装" / "AI 提示词" / "扩展属性"），用 `<Tabs>` 切换
- 或者：默认只展示核心 7 字段，"高级" 折叠面板里放剩余 17 字段
- 与项目 UX 评审 §3.3 一致："所有'占位字段'折叠为'高级'"

---

## 五、P2：长期（季度内）

### 5.1 P2-1：文档同步（`docs/requirements/modules/06-asset-library.md` + `01-product-design-spec.md`）

`docs/requirements/modules/06-asset-library.md` §"角色资产建议"只有 5 字段，代码已经有 17+ 字段。需重写：
- 角色资产字段表（基础 6 + 外貌 7 + 服装 5 + 动作 1 + 关系 1 + 提示词 1 = 21 字段）
- 场景资产字段表
- 道具资产字段表
- 三个工厂的 AI 扩展字段用法

### 5.2 P2-2：完整 E2E 测试覆盖（vitest + Playwright）

**位置**：当前 `backend/tests/e2e-consistency-pack.mjs` 只覆盖 consistency-pack API，**三个工厂的列表/编辑/AI 生成端到端无 E2E 覆盖**。

**建议**：
- vitest 单元测试：`useFactoryActions` 的 11 个 handle* + `useRecycleBin`
- Playwright E2E：3 个工厂的"创建→编辑→AI 生成→删除"完整流程

### 5.3 P2-3：把 `useFactoryEntity` 改为 SWR / React Query

**严重度：P2 — 长期维护性**

**位置**：[`useFactoryEntity.ts`](frontend/components/factory/useFactoryEntity.ts)

**问题**：自己写的 useEffect + useState + setIsLoading + reload 模式，每次需要手动 `clearApiCache()` + `reload()`，容易出现"乐观更新与后端不一致"的 bug（如 4.2 回收站计数问题）。

**建议**：引入 SWR 或 React Query，自动处理缓存、revalidate、乐观更新。

### 5.4 P2-4：与 [`images.txt`](images.txt) 双向同步（CI 检查）

**建议**：在 CI 增加契约测试——
- 前端 `image-config.ts` 必填字段与 `images.txt` "请求参数" 表一致
- 后端 `/api/images/generate` 的字段映射到 Agnes API 规范
- 文档更新时强制同步

### 5.5 P2-5：AI 生成的"风格" 与 "角色类型 / 场景类型 / 道具类别" 联动

**位置**：[`ai-generate-dialog.tsx:81-89`](frontend/components/shared/ai-generate-dialog.tsx#L81-L89)

**建议**：根据 `typeFieldValue`（如 "古装主角"）自动建议"古风"风格，减少用户输入。

---

## 六、按优先级 + 工时排期表

| # | 行动 | 涉及文件 | 预估工时 | 阻塞 |
|---|------|----------|:---:|:---:|
| P0-1 | 场景/道具编辑页路由 | 新建 `app/[entityType]/[id]/edit/page.tsx` + 抽 `EntityImageEditor.tsx` | **6h** | 主流程 |
| P0-2 | AI 生图参数对齐 `images.txt` | `ai-generate-dialog.tsx` + 后端 `ai-client-factory.ts` | **4h** | 契约 |
| P0-3 | 编辑页与 AI 对话框 size 统一 | 两个文件 + 新建 `image-config.ts` | **2h** | UX |
| P0-4 | 选中状态 store key 稳定 | `useFactoryEntity.ts` + `types.ts` + 三个 factory config | **1h** | bug 风险 |
| P1-1 | FactoryCRUDPage 模块化拆分 | 拆分 1231 行到 8 个 parts + 3 个 hooks | **12h** | 单测 |
| P1-2 | 回收站计数实时刷新 | `FactoryCRUDPage.tsx` 乐观更新 | **2h** | UX |
| P1-3 | loading 状态合并 | 抽 `<AsyncSection>` 组件 | **1h** | UX |
| P1-4 | n 参数与文档对齐 | `ai-generate-dialog.tsx` | **1h** | 契约 |
| P1-5 | inline 样式 + token 收敛 | 三个 factory + `ai-generate-dialog.tsx` | **12h** | 主题切换 |
| P1-6 | 错误反馈单层化 | `ai-generate-dialog.tsx` 去掉内层 toast | **0.5h** | UX |
| P1-7 | 候选图 lazy + skeleton | `ai-generate-dialog.tsx` | **2h** | 性能 |
| P1-8 | 键盘可达性 | 三个 factory 卡片按钮 | **4h** | WCAG |
| P1-9 | 表单字段分组 / 折叠 | 三个 factory `*Fields` 配置 | **6h** | UX |
| P2-1 | 文档同步 | `docs/requirements/modules/06-asset-library.md` + `01-product-design-spec.md` | **6h** | 文档 |
| P2-2 | E2E 测试覆盖 | 新建 `tests/e2e-factories.mjs` + vitest | **16h** | 回归 |
| P2-3 | 引入 SWR / React Query | 替换 `useFactoryEntity` | **8h** | 长期 |
| P2-4 | 契约 CI | 新增 `.github/workflows/image-contract.yml` | **4h** | 长期 |
| P2-5 | 智能风格推荐 | `ai-generate-dialog.tsx` | **4h** | 增强 |

**总计**：P0 ≈ **13h**（1.5 工作日）/ P1 ≈ **40.5h**（1 周）/ P2 ≈ **38h**（1 周）

---

## 七、与项目记忆 / 评审报告的交叉引用

| 来源 | 关联问题 |
|------|----------|
| [`project_memory.md`](file:///c:/Users/Administrator/.trae-cn/memory/projects/-d-trae-manju/project_memory.md) "2026-07-16 构建重复修复" | FactoryCRUDPage 1 次"inlined" 是 W16 dev 中"recover" 阶段：把 8 parts 重新塞回 1 文件（**已知问题**） |
| [`project_memory.md`](file:///c:/Users/Administrator/.trae-cn/memory/projects/-d-trae-manju/project_memory.md) "Pipeline node action HTTP methods" | `e2e-p1-batch.mjs` 24/24 全过（**未覆盖三个工厂的 P0 行为变更**） |
| [`ux-report/frontend-ux-review-2026-07-23.md`](file:///d:/trae/manju/ux-report/frontend-ux-review-2026-07-23.md) §4.1 P0-1 / §5.2 P0 | 假数据、alert/confirm 全站收敛，三个工厂在新版本中没有引入新 alert/confirm，**符合** |
| [`ux-report/script-center-ux-review-2026-07-24.md`](file:///d:/trae/manju/ux-report/script-center-ux-review-2026-07-24.md) §3 P0-1 | BackupManager `setPendingDeleteId` 未声明，**已识别但未修复**；三个工厂的"删除"在 toast 后立即调用 `setSelectedIds` 删除选中项，没这个问题 |
| [`docs/implementation/02-feature-status.md`](file:///d:/trae/manju/docs/implementation/02-feature-status.md) "MOD- 100%" | V2 实施状态文档说三个工厂"100% 完整"——但本评审发现的 P0-1 跳转 404 与文档 100% 自相矛盾，**应触发状态文档重新校准** |
| [`docs/requirements/modules/06-asset-library.md`](file:///d:/trae/manju/docs/requirements/modules/06-asset-library.md) §"角色资产建议" 5 字段 | 文档 5 字段，代码 24 字段，**文档严重过期** |
| [`docs/requirements/01-product-design-spec.md`](file:///d:/trae/manju/docs/requirements/01-product-design-spec.md) §3.4 角色资产包含 | 文档"基础设定、参考图、Prompt、LoRA、三视图、表情库、动作库"——代码新增的 costume_* 字段不在文档中 |
| [`chat.txt`](file:///d:/trae/manju/chat.txt) "Agnes 2.0 Flash" | 模型是 agnes-2.0-flash（语言），不是 agnes-image-2.1-flash（图像），但 AI 生成对话框没有传 `model` 字段——**隐式依赖后端默认值** |
| [`images.txt`](file:///d:/trae/manju/images.txt) "文生图：URL 输出" | 3 处参数与代码不一致（P0-2） |
| [`ux-report/frontend-ux-review-2026-07-23.md`](file:///d:/trae/manju/ux-report/frontend-ux-review-2026-07-23.md) §2.2 P1 侧边栏密度 | 三个工厂入口 4 个（一级菜单"角色/场景/道具"+"资产中心"）——**与本评审 P0 无关但建议合并** |

---

## 八、关键建议（按"必须先做"排序）

1. **先做 P0-1**（场景/道具编辑页）：阻塞主流程，所有用户都会遇到
2. **再做 P0-2 / P0-3**（AI 生图对齐）：阻塞"按文档预期"的所有集成
3. **同时做 P0-4**（store key）：低风险 + 高 ROI，避免未来调试
4. **P1-1**（FactoryCRUDPage 拆分）需要单独排期 12h，但**不做也能上线**
5. **P2-1 / P2-2**（文档 + E2E）作为下季度收口

**最低必要修复**（不可跳过）：P0-1 + P0-2 + P0-3 + P0-4 = **13h**，1.5 个工作日。

---

## 九、参考

- 上版（模块化）FactoryCRUDPage：`git show e798a57~1:frontend/components/factory/FactoryCRUDPage.tsx`
- Agnes Image 2.1 Flash 接口文档：[`images.txt`](images.txt)
- Agnes 2.0 Flash 语言模型接口：[`chat.txt`](chat.txt)
- Agnes Video V2.0：[`video.txt`](video.txt)
- V2 实施状态：[`docs/requirements/v2-implementation-status.md`](docs/requirements/v2-implementation-status.md)
- V2 强制原则整改：[`docs/requirements/v2-mandatory-principles-remediation-2026-07-23.md`](docs/requirements/v2-mandatory-principles-remediation-2026-07-23.md)
- UX 评审报告：
  - [`ux-report/frontend-ux-review-2026-07-23.md`](ux-report/frontend-ux-review-2026-07-23.md)
  - [`ux-report/script-center-ux-review-2026-07-24.md`](ux-report/script-center-ux-review-2026-07-24.md)
- WCAG 2.1 AA 标准：https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- shadcn/ui：[`components/ui/`](frontend/components/ui)
- Radix UI：[`components/shared/`](frontend/components/shared)

**研究证据**：
- `git log --oneline --all -- frontend/components/factory` (10 个 commit)
- `git log --oneline --all -- frontend/components/modules/character-factory.tsx` (4 个 commit)
- 三个 factory 文件全文阅读（536 / 464 / 478 行）
- FactoryCRUDPage 全文阅读（1231 行）
- 旧版 vs 新版 FactoryCRUDPage diff（+940% 行数 / -8 parts / -3 hooks）
- `images.txt` 文档 §"文生图：URL 输出" 与 `ai-generate-dialog.tsx:175-183` 字段对比
- `app/characters/[id]/edit/page.tsx` 与 `app/scenes/[id]/edit`/`app/props/[id]/edit` 路由存在性 LS 对比
- `project_memory.md` "2026-07-16 构建重复修复" 交叉引用
- `docs/requirements/modules/06-asset-library.md` 5 字段 vs 代码 24 字段文档漂移
