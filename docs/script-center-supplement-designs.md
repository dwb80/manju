# 剧本中心补充设计文档

> **文档版本**: V1.0  
> **创建时间**: 2026-07-10  
> **文档状态**: 待审核

---

## 目录

1. [剧本模板库设计（P2）](#一剧本模板库设计p2)
2. [剧本标签系统设计（P1）](#二剧本标签系统设计p1)
3. [剧本分类管理设计（P1）](#三剧本分类管理设计p1)
4. [剧本质量评估标准设计（P1）](#四剧本质量评估标准设计p1)
5. [剧本审批流程设计（P1）](#五剧本审批流程设计p1)
6. [数据备份和恢复设计（P2）](#六数据备份和恢复设计p2)

---

## 一、剧本模板库设计（P2）

### 1.1 需求说明

剧本模板库旨在为用户提供预制的剧本结构模板，帮助编剧快速开始创作，减少重复性工作。

**核心功能**：
- 提供多种剧本类型模板（短剧、长剧、电影、纪录片等）
- 支持模板预览和试用
- 支持基于模板创建新剧本
- 支持自定义模板的创建和管理

**用户场景**：
- 新编剧：使用标准模板快速上手
- 专业编剧：创建自己的模板库供团队使用
- 项目经理：为项目选择合适的剧本模板

### 1.2 数据模型设计

```typescript
/** 剧本模板类型 */
export type ScriptTemplateType = 'short_series' | 'long_series' | 'movie' | 'documentary' | 'commercial' | 'custom';

/** 剧本模板状态 */
export type ScriptTemplateStatus = 'draft' | 'active' | 'archived' | 'deprecated';

/** 剧本模板实体 */
export interface ScriptTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板类型 */
  type: ScriptTemplateType;
  /** 模板描述 */
  description: string;
  /** 模板状态 */
  status: ScriptTemplateStatus;
  /** 模板作者 */
  author: string;
  /** 模板版本号 */
  version: number;
  /** 模板内容（包含预设的场景、角色、情节结构） */
  content: {
    /** 世界观预设 */
    worldview?: string;
    /** 角色预设列表 */
    characters?: Array<{
      name: string;
      role: string;
      description: string;
    }>;
    /** 场景预设列表 */
    scenes?: Array<{
      name: string;
      type: string;
      description: string;
    }>;
    /** 情节结构预设 */
    plotStructure?: Array<{
      episode: number;
      title: string;
      summary: string;
      scenes: string[];
    }>;
    /** 剧本正文模板 */
    scriptTemplate?: string;
  };
  /** 使用次数统计 */
  usageCount: number;
  /** 评分（平均） */
  rating: number;
  /** 标签 */
  tags: string[];
  /** 是否为系统模板 */
  isSystem: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}
```

### 1.3 API接口设计

#### 1.3.1 获取模板列表

```typescript
// GET /api/script-templates
interface GetScriptTemplatesRequest {
  type?: ScriptTemplateType;
  status?: ScriptTemplateStatus;
  author?: string;
  tags?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
}

interface GetScriptTemplatesResponse {
  templates: ScriptTemplate[];
  total: number;
  page: number;
  pageSize: number;
}
```

#### 1.3.2 获取单个模板详情

```typescript
// GET /api/script-templates/:id
interface GetScriptTemplateResponse {
  template: ScriptTemplate;
}
```

#### 1.3.3 创建自定义模板

```typescript
// POST /api/script-templates
interface CreateScriptTemplateRequest {
  name: string;
  type: ScriptTemplateType;
  description: string;
  content: ScriptTemplate['content'];
  tags?: string[];
}

interface CreateScriptTemplateResponse {
  template: ScriptTemplate;
}
```

#### 1.3.4 更新模板

```typescript
// PUT /api/script-templates/:id
interface UpdateScriptTemplateRequest {
  name?: string;
  description?: string;
  content?: ScriptTemplate['content'];
  tags?: string[];
  status?: ScriptTemplateStatus;
}

interface UpdateScriptTemplateResponse {
  template: ScriptTemplate;
}
```

#### 1.3.5 基于模板创建剧本

```typescript
// POST /api/script-templates/:id/create-script
interface CreateScriptFromTemplateRequest {
  projectId?: string;
  scriptName: string;
  customizations?: {
    worldview?: string;
    characters?: ScriptTemplate['content']['characters'];
    scenes?: ScriptTemplate['content']['scenes'];
  };
}

interface CreateScriptFromTemplateResponse {
  scriptId: string;
  message: string;
}
```

#### 1.3.6 评分模板

```typescript
// POST /api/script-templates/:id/rate
interface RateScriptTemplateRequest {
  rating: number; // 1-5
  comment?: string;
}

interface RateScriptTemplateResponse {
  averageRating: number;
  message: string;
}
```

### 1.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  剧本模板库                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 筛选栏 ──────────────────────────────────────────────┐ │
│  │ [类型: 全部▼] [状态: 活跃▼] [搜索: _______________]  │ │
│  │                    [筛选] [重置]                     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 模板卡片网格 ────────────────────────────────────────┐ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │ │
│  │ │ 短剧 │ │ 长剧 │ │ 电影 │ │ 商业 │                  │ │
│  │ │ 模板 │ │ 模板 │ │ 模板 │ │ 广告 │                  │ │
│  │ │ 4.5★ │ │ 4.8★ │ │ 4.6★ │ │ 4.3★ │                  │ │
│  │ │已用: │ │已用: │ │已用: │ │已用: │                  │ │
│  │ │ 120 │ │ 85  │ │ 45  │ │ 32  │                  │ │
│  │ │[预览]│ │[预览]│ │[预览]│ │[预览]│                  │ │
│  │ │[使用]│ │[使用]│ │[使用]│ │[使用]│                  │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘                  │ │
│  │                                                         │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐                            │ │
│  │ │古风  │ │现代  │ │科幻  │                            │ │
│  │ │短剧  │ │都市  │ │冒险  │                            │ │
│  │ │ 4.7★ │ │ 4.5★ │ │ 4.4★ │                            │ │
│  │ │已用: │ │已用: │ │已用: │                            │ │
│  │ │ 200 │ │ 150 │ │ 80  │                            │ │
│  │ │[预览]│ │[预览]│ │[预览]│                            │ │
│  │ │[使用]│ │[使用]│ │[使用]│                            │ │
│  │ └──────┘ └──────┘ └──────┘                            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 操作栏 ───────────────────────────────────────────────┐ │
│  │ [创建自定义模板]                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                         [上一页] 1/5 [下一页]                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **模板列表展示** | ✅ 能正确显示所有模板卡片，包含名称、类型、评分、使用次数 |
| **模板筛选** | ✅ 能按类型、状态、标签筛选模板 |
| **模板预览** | ✅ 点击预览能看到完整的模板内容（世界观、角色、场景、情节结构） |
| **基于模板创建剧本** | ✅ 点击使用后能成功创建新剧本，预设内容正确填充 |
| **自定义模板创建** | ✅ 能成功创建自定义模板，保存到数据库 |
| **模板评分** | ✅ 能对模板评分，平均评分实时更新 |
| **模板搜索** | ✅ 能搜索模板名称和描述 |
| **模板使用统计** | ✅ 每次使用后使用次数正确增加 |

---

## 二、剧本标签系统设计（P1）

### 2.1 需求说明

剧本标签系统用于对剧本进行多维度的标记和分类，支持快速检索和组织管理。

**核心功能**：
- 创建和管理剧本标签
- 为剧本添加多个标签
- 支持标签分组（类型、风格、主题等）
- 支持标签搜索和筛选
- 支持标签统计和分析

**用户场景**：
- 编剧：为自己的剧本添加标签，便于分类管理
- 项目经理：通过标签快速筛选剧本
- 系统管理员：管理全局标签库

### 2.2 数据模型设计

```typescript
/** 标签类型 */
export type ScriptTagType = 'genre' | 'style' | 'theme' | 'mood' | 'setting' | 'custom';

/** 剧本标签实体 */
export interface ScriptTag {
  /** 标签唯一标识 */
  id: string;
  /** 标签名称 */
  name: string;
  /** 标签类型 */
  type: ScriptTagType;
  /** 标签颜色（用于界面展示） */
  color: string;
  /** 标签描述 */
  description: string;
  /** 标签图标 */
  icon?: string;
  /** 父标签ID（支持层级标签） */
  parentId?: string;
  /** 使用次数 */
  usageCount: number;
  /** 是否为系统标签 */
  isSystem: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 剧本-标签关联实体 */
export interface ScriptTagRelation {
  /** 关联唯一标识 */
  id: string;
  /** 剧本ID */
  scriptId: string;
  /** 标签ID */
  tagId: string;
  /** 创建时间 */
  created_at: string;
}
```

### 2.3 API接口设计

#### 2.3.1 获取标签列表

```typescript
// GET /api/script-tags
interface GetScriptTagsRequest {
  type?: ScriptTagType;
  parentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface GetScriptTagsResponse {
  tags: ScriptTag[];
  total: number;
  page: number;
  pageSize: number;
}
```

#### 2.3.2 创建标签

```typescript
// POST /api/script-tags
interface CreateScriptTagRequest {
  name: string;
  type: ScriptTagType;
  color?: string;
  description?: string;
  icon?: string;
  parentId?: string;
}

interface CreateScriptTagResponse {
  tag: ScriptTag;
}
```

#### 2.3.3 更新标签

```typescript
// PUT /api/script-tags/:id
interface UpdateScriptTagRequest {
  name?: string;
  color?: string;
  description?: string;
  icon?: string;
}

interface UpdateScriptTagResponse {
  tag: ScriptTag;
}
```

#### 2.3.4 为剧本添加标签

```typescript
// POST /api/scripts/:scriptId/tags
interface AddScriptTagsRequest {
  tagIds: string[];
}

interface AddScriptTagsResponse {
  addedCount: number;
  message: string;
}
```

#### 2.3.5 移除剧本标签

```typescript
// DELETE /api/scripts/:scriptId/tags/:tagId
interface RemoveScriptTagResponse {
  message: string;
}
```

#### 2.3.6 获取剧本的标签

```typescript
// GET /api/scripts/:scriptId/tags
interface GetScriptTagsResponse {
  tags: ScriptTag[];
}
```

#### 2.3.7 按标签筛选剧本

```typescript
// GET /api/scripts/by-tags
interface GetScriptsByTagsRequest {
  tagIds: string[];
  matchMode?: 'any' | 'all'; // 匹配任一标签或全部标签
}

interface GetScriptsByTagsResponse {
  scripts: Script[];
  total: number;
}
```

### 2.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  剧本标签管理                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 标签分组 ──────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ [类型标签]                                               │ │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │ │
│  │ │古风│ │现代│ │科幻│ │悬疑│ │喜剧│  [+添加]            │ │
│  │ │#F00│ │#0F0│ │#00F│ │#FF0│ │#F0F│                    │ │
│  │ └────┘ └────┘ └────┘ └────┘ └────┘                    │ │
│  │                                                         │ │
│  │ [风格标签]                                               │ │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                            │ │
│  │ │浪漫│ │写实│ │梦幻│ │暗黑│  [+添加]                   │ │
│  │ │#F90│ │#09F│ │#9F0│ │#90F│                            │ │
│  │ └────┘ └────┘ └────┘ └────┘                            │ │
│  │                                                         │ │
│  │ [主题标签]                                               │ │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │ │
│  │ │爱情│ │友情│ │复仇│ │成长│ │冒险│  [+添加]            │ │
│  │ └────┘ └────┘ └────┘ └────┘ └────┘                    │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 剧本标签应用 ──────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 剧本：茶信馆传奇                                         │ │
│  │ 已添加标签：                                            │ │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                            │ │
│  │ │古风│ │爱情│ │复仇│ │武侠│  [×] [×] [×] [×]          │ │
│  │ └────┘ └────┘ └────┘ └────┘                            │ │
│  │                                                         │ │
│  │ 添加新标签：[搜索标签...▼] [添加]                       │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 标签统计 ──────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 类型标签使用TOP5：                                      │ │
│  │ 1. 古风 (120个剧本)                                     │ │
│  │ 2. 现代 (85个剧本)                                      │ │
│  │ 3. 科幻 (45个剧本)                                      │ │
│  │ 4. 悬疑 (32个剧本)                                      │ │
│  │ 5. 喜剧 (28个剧本)                                      │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **标签创建** | ✅ 能成功创建新标签，包含名称、类型、颜色 |
| **标签分组展示** | ✅ 能按类型分组展示标签（类型、风格、主题等） |
| **标签层级支持** | ✅ 支持父子标签关系，正确展示层级结构 |
| **为剧本添加标签** | ✅ 能为剧本添加多个标签，实时显示 |
| **移除剧本标签** | ✅ 能成功移除剧本标签 |
| **标签搜索** | ✅ 能搜索标签名称 |
| **按标签筛选剧本** | ✅ 能通过标签筛选剧本，支持"任一"或"全部"匹配模式 |
| **标签使用统计** | ✅ 能显示标签使用次数和TOP排名 |
| **标签颜色管理** | ✅ 能设置和修改标签颜色 |

---

## 三、剧本分类管理设计（P1）

### 3.1 需求说明

剧本分类管理用于对剧本进行层级化的分类组织，支持项目级别的剧本管理。

**核心功能**：
- 创建和管理剧本分类目录
- 支持多层级分类结构
- 支持剧本归类到分类
- 支持分类批量操作
- 支持分类权限管理

**用户场景**：
- 项目经理：为项目创建分类结构
- 编剧：将剧本归类到合适的分类
- 系统管理员：管理全局分类标准

### 3.2 数据模型设计

```typescript
/** 剧本分类实体 */
export interface ScriptCategory {
  /** 分类唯一标识 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description: string;
  /** 父分类ID（支持多层级） */
  parentId?: string;
  /** 分类路径（从根到当前） */
  path: string;
  /** 分类层级深度 */
  level: number;
  /** 分类图标 */
  icon?: string;
  /** 分类颜色 */
  color?: string;
  /** 所属项目ID（空表示全局分类） */
  projectId?: string;
  /** 分类下的剧本数量 */
  scriptCount: number;
  /** 排序序号 */
  order: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 剧本-分类关联实体 */
export interface ScriptCategoryRelation {
  /** 关联唯一标识 */
  id: string;
  /** 剧本ID */
  scriptId: string;
  /** 分类ID */
  categoryId: string;
  /** 创建时间 */
  created_at: string;
}
```

### 3.3 API接口设计

#### 3.3.1 获取分类树

```typescript
// GET /api/script-categories/tree
interface GetCategoryTreeRequest {
  projectId?: string;
}

interface GetCategoryTreeResponse {
  tree: ScriptCategory[];
}
```

#### 3.3.2 创建分类

```typescript
// POST /api/script-categories
interface CreateScriptCategoryRequest {
  name: string;
  description?: string;
  parentId?: string;
  projectId?: string;
  icon?: string;
  color?: string;
}

interface CreateScriptCategoryResponse {
  category: ScriptCategory;
}
```

#### 3.3.3 更新分类

```typescript
// PUT /api/script-categories/:id
interface UpdateScriptCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
}

interface UpdateScriptCategoryResponse {
  category: ScriptCategory;
}
```

#### 3.3.4 删除分类

```typescript
// DELETE /api/script-categories/:id
interface DeleteScriptCategoryRequest {
  moveToParent?: boolean; // 是否将子分类和剧本移到父分类
}

interface DeleteScriptCategoryResponse {
  message: string;
  movedScripts?: number;
}
```

#### 3.3.5 移动分类

```typescript
// POST /api/script-categories/:id/move
interface MoveCategoryRequest {
  newParentId?: string; // 新父分类ID
  newOrder?: number;    // 新排序序号
}

interface MoveCategoryResponse {
  category: ScriptCategory;
}
```

#### 3.3.6 将剧本归类

```typescript
// POST /api/scripts/:scriptId/category
interface AssignScriptCategoryRequest {
  categoryId: string;
}

interface AssignScriptCategoryResponse {
  message: string;
}
```

#### 3.3.7 获取分类下的剧本

```typescript
// GET /api/script-categories/:id/scripts
interface GetCategoryScriptsRequest {
  includeSubcategories?: boolean; // 是否包含子分类下的剧本
  page?: number;
  pageSize?: number;
}

interface GetCategoryScriptsResponse {
  scripts: Script[];
  total: number;
}
```

### 3.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  剧本分类管理                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 分类树形结构 ───────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 📁 全部剧本 (500)                                       │ │
│  │   ├─ 📁 古风剧 (120)                                    │ │
│  │   │   ├─ 📁 武侠 (45)                                   │ │
│  │   │   ├─ 📁 历史 (35)                                   │ │
│  │   │   ├─ 📁 仙侠 (40)                                   │ │
│  │   │   [+新建子分类]                                     │ │
│  │   │                                                     │ │
│  │   ├─ 📁 现代剧 (85)                                     │ │
│  │   │   ├─ 📁 都市 (40)                                   │ │
│  │   │   ├─ 📁 职场 (25)                                   │ │
│  │   │   ├─ 📁 校园 (20)                                   │ │
│  │   │                                                     │ │
│  │   ├─ 📁 科幻剧 (45)                                     │ │
│  │   ├─ 📁 悬疑剧 (32)                                     │ │
│  │   ├─ 📁 儿童剧 (28)                                     │ │
│  │   [+新建分类]                                           │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 分类操作 ───────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 当前选中：古风剧/武侠                                    │ │
│  │                                                         │ │
│  │ [重命名] [移动] [删除] [添加剧本]                        │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 分类下的剧本列表 ───────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 剧本名称          状态     字数     创建时间             │ │
│  │ ─────────────────────────────────────────────────────  │ │
│  │ 茶信馆传奇        已完成   5000     2026-01-01           │ │
│  │ 剑影迷踪          草稿     3000     2026-02-01           │ │
│  │ 江湖往事          进行中   4500     2026-03-01           │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **分类树展示** | ✅ 能正确展示多层级分类树结构 |
| **分类创建** | ✅ 能创建新分类，设置名称、父分类、图标、颜色 |
| **分类更新** | ✅ 能修改分类名称、描述、图标、颜色 |
| **分类删除** | ✅ 能删除分类，可选择将内容移到父分类 |
| **分类移动** | ✅ 能移动分类到新的父分类下 |
| **剧本归类** | ✅ 能将剧本归类到指定分类 |
| **分类剧本列表** | ✅ 能查看分类下的剧本，支持包含子分类 |
| **分类统计** | ✅ 能显示每个分类下的剧本数量 |
| **分类排序** | ✅ 能调整分类的显示顺序 |

---

## 四、剧本质量评估标准设计（P1）

### 4.1 需求说明

剧本质量评估标准用于建立剧本的质量评分体系，支持AI自动评估和人工评分。

**核心功能**：
- 定义多维度评分标准
- 支持AI自动评分
- 支持人工评分和审核
- 支持评分历史记录
- 支持评分报告生成

**用户场景**：
- 编剧：了解自己剧本的质量评分
- 审核人员：按照标准对剧本评分
- 项目经理：查看剧本质量报告
- 系统管理员：配置评分标准

### 4.2 数据模型设计

```typescript
/** 评估维度 */
export type EvaluationDimension = 
  | 'plot'         // 情节结构
  | 'character'    // 人物塑造
  | 'dialogue'     // 对白质量
  | 'pacing'       // 节奏把控
  | 'originality'  // 创意原创性
  | 'theme'        // 主题表达
  | 'logic';       // 逻辑连贯性

/** 评分标准实体 */
export interface EvaluationCriteria {
  /** 标准唯一标识 */
  id: string;
  /** 维度名称 */
  dimension: EvaluationDimension;
  /** 维度描述 */
  description: string;
  /** 权重（百分比） */
  weight: number;
  /** 评分细则 */
  criteria: Array<{
    scoreRange: [number, number]; // 分数范围
    description: string;          // 评分说明
    indicators: string[];         // 评分指标
  }>;
  /** 是否启用AI评分 */
  aiEnabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 剧本评分实体 */
export interface ScriptEvaluation {
  /** 评分唯一标识 */
  id: string;
  /** 剧本ID */
  scriptId: string;
  /** 评分版本 */
  version: number;
  /** 评分类型（AI/人工） */
  type: 'ai' | 'manual';
  /** 评分人（人工评分时） */
  evaluator?: string;
  /** 各维度评分 */
  dimensions: Array<{
    dimension: EvaluationDimension;
    score: number;        // 0-100
    maxScore: number;     // 100
    weight: number;       // 权重
    details?: string;     // 评分详情
  }>;
  /** 总分 */
  totalScore: number;
  /** 评分等级 */
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  /** 评分建议 */
  suggestions: string[];
  /** 创建时间 */
  created_at: string;
}
```

### 4.3 API接口设计

#### 4.3.1 获取评分标准

```typescript
// GET /api/evaluation-criteria
interface GetEvaluationCriteriaResponse {
  criteria: EvaluationCriteria[];
}
```

#### 4.3.2 更新评分标准

```typescript
// PUT /api/evaluation-criteria/:dimension
interface UpdateEvaluationCriteriaRequest {
  weight?: number;
  criteria?: EvaluationCriteria['criteria'];
  aiEnabled?: boolean;
}

interface UpdateEvaluationCriteriaResponse {
  criteria: EvaluationCriteria;
}
```

#### 4.3.3 AI自动评分

```typescript
// POST /api/scripts/:scriptId/evaluate/ai
interface AIEvaluateRequest {
  force?: boolean; // 是否强制重新评分
}

interface AIEvaluateResponse {
  evaluation: ScriptEvaluation;
}
```

#### 4.3.4 人工评分

```typescript
// POST /api/scripts/:scriptId/evaluate/manual
interface ManualEvaluateRequest {
  dimensions: ScriptEvaluation['dimensions'];
  suggestions?: string[];
}

interface ManualEvaluateResponse {
  evaluation: ScriptEvaluation;
}
```

#### 4.3.5 获取评分历史

```typescript
// GET /api/scripts/:scriptId/evaluations
interface GetEvaluationHistoryRequest {
  page?: number;
  pageSize?: number;
}

interface GetEvaluationHistoryResponse {
  evaluations: ScriptEvaluation[];
  total: number;
}
```

#### 4.3.6 获取评分报告

```typescript
// GET /api/scripts/:scriptId/evaluation/report
interface GetEvaluationReportResponse {
  currentEvaluation: ScriptEvaluation;
  history: ScriptEvaluation[];
  analysis: {
    improvementTrend: 'improving' | 'stable' | 'declining';
    strongDimensions: EvaluationDimension[];
    weakDimensions: EvaluationDimension[];
    suggestions: string[];
  };
}
```

### 4.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  剧本质量评估                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 当前评分 ───────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 剧本：茶信馆传奇                                         │ │
│  │ 总分：85分 (A级)                                        │ │
│  │                                                         │ │
│  │ ┌─ 维度评分 ───────────────────────────────────────────┐ │ │
│  │ │ 情节结构    ████████░░  80分 (权重20%)               │ │ │
│  │ │ 人物塑造    █████████░  90分 (权重20%)               │ │ │
│  │ │ 对白质量    ███████░░░  75分 (权重15%)               │ │ │
│  │ │ 节奏把控    ████████░░  80分 (权重15%)               │ │ │
│  │ │ 创意原创性  ████████░░  80分 (权重10%)               │ │ │
│  │ │ 主题表达    ████████░░  85分 (权重10%)               │ │ │
│  │ │ 逻辑连贯性  ████████░░  80分 (权重10%)               │ │ │
│  │ └───────────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │ 评分类型：AI自动评分                                     │ │
│  │ 评分时间：2026-07-10 14:30                               │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 评分建议 ───────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ ✅ 优势维度：人物塑造                                    │ │
│  │    - 人物性格鲜明，形象丰满                              │ │
│  │    - 人物关系复杂，层次清晰                              │ │
│  │                                                         │ │
│  │ ⚠️ 待改进维度：对白质量                                  │ │
│  │    - 部分对白略显平淡，建议增加情感张力                  │ │
│  │    - 个别台词过于直白，建议用潜台词表达                  │ │
│  │    - 建议增加角色个性化的语言风格                        │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 操作按钮 ───────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ [重新AI评分] [人工评分] [查看历史] [生成报告]            │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **评分标准配置** | ✅ 能配置各维度的权重和评分细则 |
| **AI自动评分** | ✅ AI能按照标准对剧本自动评分 |
| **人工评分** | ✅ 审核人员能按照标准对剧本人工评分 |
| **维度评分展示** | ✅ 能展示各维度的分数和权重 |
| **总分计算** | ✅ 总分正确按照权重加权计算 |
| **评分等级** | ✅ 能正确映射分数到等级（S/A/B/C/D/F） |
| **评分建议** | ✅ 能生成针对性的改进建议 |
| **评分历史** | ✅ 能查看剧本的评分历史记录 |
| **评分报告** | ✅ 能生成完整的评分分析报告 |
| **改进趋势** | ✅ 能分析剧本质量的改进趋势 |

---

## 五、剧本审批流程设计（P1）

### 5.1 需求说明

剧本审批流程用于管理剧本的审核、批准和发布流程，支持多级审批和流转。

**核心功能**：
- 定义审批流程模板
- 创建和管理审批申请
- 支持多级审批和流转
- 支持审批意见和批注
- 支持审批历史和状态跟踪
- 支持审批通知和提醒

**用户场景**：
- 编剧：提交剧本申请审批
- 审批人员：审批剧本并提供意见
- 项目经理：跟踪审批进度
- 系统管理员：配置审批流程模板

### 5.2 数据模型设计

```typescript
/** 审批状态 */
export type ApprovalStatus = 
  | 'draft'      // 草稿
  | 'submitted'  // 已提交
  | 'reviewing'  // 审核中
  | 'approved'   // 已批准
  | 'rejected'   // 已拒绝
  | 'revision'   // 待修改
  | 'archived';  // 已归档

/** 审批节点类型 */
export type ApprovalNodeType = 
  | 'submit'     // 提交节点
  | 'review'     // 审核节点
  | 'approve'    // 批准节点
  | 'publish';   // 发布节点

/** 审批流程模板实体 */
export interface ApprovalWorkflowTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 审批节点列表 */
  nodes: Array<{
    id: string;
    type: ApprovalNodeType;
    name: string;
    order: number;
    approvers: string[];  // 审批人员列表
    requiredApprovals: number; // 需要的批准数
    timeoutDays?: number;  // 超时天数
    autoApprove?: boolean; // 自动批准条件
  }>;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 剧本审批申请实体 */
export interface ScriptApproval {
  /** 审批唯一标识 */
  id: string;
  /** 剧本ID */
  scriptId: string;
  /** 申请人 */
  applicant: string;
  /** 审批状态 */
  status: ApprovalStatus;
  /** 当前审批节点 */
  currentNode: string;
  /** 审批流程模板ID */
  workflowId: string;
  /** 审批记录 */
  records: Array<{
    nodeId: string;
    nodeType: ApprovalNodeType;
    approver: string;
    action: 'approve' | 'reject' | 'comment' | 'delegate';
    comment?: string;
    timestamp: string;
  }>;
  /** 审批意见汇总 */
  comments: Array<{
    reviewer: string;
    comment: string;
    position?: string;  // 批注位置
    timestamp: string;
  }>;
  /** 审批版本 */
  version: number;
  /** 提交时间 */
  submitted_at?: string;
  /** 完成时间 */
  completed_at?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}
```

### 5.3 API接口设计

#### 5.3.1 获取审批流程模板

```typescript
// GET /api/approval-workflows
interface GetApprovalWorkflowsResponse {
  workflows: ApprovalWorkflowTemplate[];
}
```

#### 5.3.2 创建审批流程模板

```typescript
// POST /api/approval-workflows
interface CreateApprovalWorkflowRequest {
  name: string;
  description?: string;
  nodes: ApprovalWorkflowTemplate['nodes'];
}

interface CreateApprovalWorkflowResponse {
  workflow: ApprovalWorkflowTemplate;
}
```

#### 5.3.3 提交审批申请

```typescript
// POST /api/scripts/:scriptId/approval
interface SubmitApprovalRequest {
  workflowId: string;
  note?: string; // 提交说明
}

interface SubmitApprovalResponse {
  approval: ScriptApproval;
}
```

#### 5.3.4 审批操作

```typescript
// POST /api/script-approvals/:id/action
interface ApprovalActionRequest {
  action: 'approve' | 'reject' | 'comment' | 'delegate';
  comment?: string;
  delegateTo?: string; // 委托审批时
}

interface ApprovalActionResponse {
  approval: ScriptApproval;
}
```

#### 5.3.5 添加批注

```typescript
// POST /api/script-approvals/:id/comment
interface AddApprovalCommentRequest {
  comment: string;
  position?: string; // 批注位置（章节/段落）
}

interface AddApprovalCommentResponse {
  message: string;
}
```

#### 5.3.6 获取审批详情

```typescript
// GET /api/script-approvals/:id
interface GetApprovalDetailResponse {
  approval: ScriptApproval;
  workflow: ApprovalWorkflowTemplate;
}
```

#### 5.3.7 获取我的审批列表

```typescript
// GET /api/my-approvals
interface GetMyApprovalsRequest {
  type?: 'pending' | 'completed' | 'submitted';
  page?: number;
  pageSize?: number;
}

interface GetMyApprovalsResponse {
  approvals: ScriptApproval[];
  total: number;
}
```

#### 5.3.8 获取审批历史

```typescript
// GET /api/scripts/:scriptId/approval-history
interface GetApprovalHistoryResponse {
  approvals: ScriptApproval[];
}
```

### 5.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  剧本审批中心                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 审批流程可视化 ──────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ [提交] → [编剧审核] → [导演审核] → [制片人批准] → [发布] │ │
│  │   ✓        ⏳             ⏸️            ⏸️           ⏸️   │ │
│  │                                                         │ │
│  │ 当前节点：编剧审核                                        │ │
│  │ 审批人：张编剧、李编剧                                    │ │
│  │ 已批准：1/2                                              │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 审批记录 ────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 时间          节点      审批人   动作    意见             │ │
│  │ ─────────────────────────────────────────────────────── │ │
│  │ 2026-07-10    提交      王编剧   提交    初稿完成，申请审核 │ │
│  │ 14:00                                                  │ │
│  │                                                         │ │
│  │ 2026-07-10    编剧审核  张编剧   批准    结构完整，人物清晰 │ │
│  │ 15:30                                                  │ │
│  │                                                         │ │
│  │ 2026-07-10    编剧审核  李编剧   待审批  ...               │ │
│  │ 16:00                                                  │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 审批意见与批注 ───────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 章节：第一章/第三场                                      │ │
│  │ 批注位置：茶信馆门口场景                                  │ │
│  │                                                         │ │
│  │ 张编剧：                                                 │ │
│  │ "场景描述很好，但林逸的动作可以更细腻一些。                │ │
│  │  建议增加他推开木门时的犹豫感，体现内心的矛盾。"           │ │
│  │                                                         │ │
│  │ 李编剧：                                                 │ │
│  │ "对白部分略显直白，建议用潜台词表达林逸的冷淡。            │ │
│  │  例如：'与你无关'可以改为更含蓄的表达。"                  │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 审批操作 ────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ [批准] [拒绝] [添加批注] [委托他人] [查看剧本]            │ │
│  │                                                         │ │
│  │ 审批意见：[输入审批意见...                           ]    │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **审批流程配置** | ✅ 能创建和配置审批流程模板 |
| **审批申请提交** | ✅ 编剧能成功提交审批申请 |
| **审批流程可视化** | ✅ 能清晰展示审批流程进度 |
| **多级审批** | ✅ 能按流程节点依次审批 |
| **审批操作** | ✅ 支持 approve/reject/comment/delegate 操作 |
| **审批批注** | ✅ 能在剧本特定位置添加批注 |
| **审批历史** | ✅ 能查看完整的审批记录历史 |
| **审批通知** | ✅ 审批人能收到审批通知 |
| **审批超时提醒** | ✅ 能提醒超时未审批的任务 |
| **审批委托** | ✅ 能将审批委托给其他人 |
| **审批状态跟踪** | ✅ 能实时查看审批状态 |

---

## 六、数据备份和恢复设计（P2）

### 6.1 需求说明

数据备份和恢复用于保障剧本数据的安全性，支持定期备份和灾难恢复。

**核心功能**：
- 自动定期备份
- 手动备份和导出
- 备份版本管理
- 数据恢复和还原
- 备份数据完整性校验
- 备份策略配置

**用户场景**：
- 系统管理员：配置备份策略，管理备份版本
- 用户：手动备份重要剧本，恢复误删内容
- 运维人员：灾难恢复时还原系统数据

### 6.2 数据模型设计

```typescript
/** 备份类型 */
export type BackupType = 
  | 'auto'      // 自动备份
  | 'manual'    // 手动备份
  | 'scheduled' // 定时备份
  | 'export';   // 导出备份

/** 备份范围 */
export type BackupScope = 
  | 'full'      // 全量备份
  | 'incremental' // 增量备份
  | 'script'    // 单个剧本
  | 'project';  // 单个项目

/** 备份状态 */
export type BackupStatus = 
  | 'creating'  // 创建中
  | 'completed' // 已完成
  | 'failed'    // 失败
  | 'restoring' // 恢复中
  | 'restored'  // 已恢复
  | 'deleted';  // 已删除

/** 剧本备份实体 */
export interface ScriptBackup {
  /** 备份唯一标识 */
  id: string;
  /** 备份名称 */
  name: string;
  /** 备份类型 */
  type: BackupType;
  /** 备份范围 */
  scope: BackupScope;
  /** 备份状态 */
  status: BackupStatus;
  /** 关联的剧本ID（单剧本备份时） */
  scriptId?: string;
  /** 关联的项目ID（项目备份时） */
  projectId?: string;
  /** 备份数据路径 */
  backupPath: string;
  /** 备份数据大小（字节） */
  size: number;
  /** 备份数据摘要（用于完整性校验） */
  checksum: string;
  /** 备份数据格式 */
  format: 'json' | 'csv' | 'zip' | 'sqlite';
  /** 备份数据内容 */
  content: {
    scripts?: Script[];
    characters?: Character[];
    scenes?: Scene[];
    evaluations?: ScriptEvaluation[];
    approvals?: ScriptApproval[];
    tags?: ScriptTag[];
    categories?: ScriptCategory[];
  };
  /** 备份数据版本（对应系统版本） */
  systemVersion: string;
  /** 创建者 */
  createdBy: string;
  /** 备份备注 */
  notes?: string;
  /** 保留天数 */
  retentionDays: number;
  /** 过期时间 */
  expiresAt?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 备份配置实体 */
export interface BackupConfig {
  /** 配置唯一标识 */
  id: string;
  /** 自动备份开关 */
  autoBackupEnabled: boolean;
  /** 备份频率（天数） */
  backupFrequency: number;
  /** 备份时间（小时） */
  backupHour: number;
  /** 备份范围 */
  backupScope: BackupScope;
  /** 备份数据格式 */
  backupFormat: 'json' | 'csv' | 'zip' | 'sqlite';
  /** 备份保留策略 */
  retentionPolicy: {
    dailyRetention: number;    // 日备份保留天数
    weeklyRetention: number;   // 周备份保留周数
    monthlyRetention: number;  // 月备份保留月数
    maxTotalBackups: number;   // 最大备份总数
  };
  /** 备份存储路径 */
  storagePath: string;
  /** 备份压缩开关 */
  compressionEnabled: boolean;
  /** 备份加密开关 */
  encryptionEnabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}
```

### 6.3 API接口设计

#### 6.3.1 获取备份配置

```typescript
// GET /api/backup-config
interface GetBackupConfigResponse {
  config: BackupConfig;
}
```

#### 6.3.2 更新备份配置

```typescript
// PUT /api/backup-config
interface UpdateBackupConfigRequest {
  autoBackupEnabled?: boolean;
  backupFrequency?: number;
  backupHour?: number;
  backupScope?: BackupScope;
  backupFormat?: BackupConfig['backupFormat'];
  retentionPolicy?: BackupConfig['retentionPolicy'];
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
}

interface UpdateBackupConfigResponse {
  config: BackupConfig;
}
```

#### 6.3.3 创建手动备份

```typescript
// POST /api/backups
interface CreateBackupRequest {
  name?: string;
  scope: BackupScope;
  scriptId?: string;
  projectId?: string;
  notes?: string;
}

interface CreateBackupResponse {
  backupId: string;
  message: string;
}
```

#### 6.3.4 获取备份列表

```typescript
// GET /api/backups
interface GetBackupsRequest {
  type?: BackupType;
  scope?: BackupScope;
  status?: BackupStatus;
  scriptId?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
}

interface GetBackupsResponse {
  backups: ScriptBackup[];
  total: number;
}
```

#### 6.3.5 获取备份详情

```typescript
// GET /api/backups/:id
interface GetBackupDetailResponse {
  backup: ScriptBackup;
}
```

#### 6.3.6 恢复备份

```typescript
// POST /api/backups/:id/restore
interface RestoreBackupRequest {
  restoreScope?: BackupScope; // 恢复范围（默认与备份范围一致）
  overwrite?: boolean;        // 是否覆盖现有数据
  createNew?: boolean;        // 是否创建为新副本
}

interface RestoreBackupResponse {
  message: string;
  restoredItems?: {
    scripts?: number;
    characters?: number;
    scenes?: number;
  };
}
```

#### 6.3.7 删除备份

```typescript
// DELETE /api/backups/:id
interface DeleteBackupResponse {
  message: string;
}
```

#### 6.3.8 导出备份

```typescript
// POST /api/backups/:id/export
interface ExportBackupRequest {
  format?: 'json' | 'csv' | 'zip';
}

interface ExportBackupResponse {
  exportUrl: string;
  message: string;
}
```

#### 6.3.9 校验备份完整性

```typescript
// POST /api/backups/:id/verify
interface VerifyBackupResponse {
  isValid: boolean;
  checksumMatch: boolean;
  dataIntegrity: boolean;
  errors?: string[];
}
```

### 6.4 界面设计原型

```
┌─────────────────────────────────────────────────────────────┐
│  数据备份和恢复                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 备份配置 ────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 自动备份：[开启 ✓]                                       │ │
│  │ 备份频率：每 [1] 天                                      │ │
│  │ 备份时间：[02:00▼]                                       │ │
│  │ 备份范围：[全量▼]                                        │ │
│  │ 备份数据格式：[JSON▼]                                    │ │
│  │                                                         │ │
│  │ 保留策略：                                               │ │
│  │ - 日备份保留：[7] 天                                     │ │
│  │ - 周备份保留：[4] 周                                     │ │
│  │ - 月备份保留：[12] 月                                    │ │
│  │ - 最大备份总数：[100]                                    │ │
│  │                                                         │ │
│  │ 存储路径：[/data/backups]                                │ │
│  │ 压缩：[开启 ✓]                                           │ │
│  │ 加密：[开启 ✓]                                           │ │
│  │                                                         │ │
│  │ [保存配置]                                               │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 备份列表 ────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ [创建手动备份]                                           │ │
│  │                                                         │ │
│  │ 备份名称        类型   范围    大小     状态    创建时间  │ │
│  │ ─────────────────────────────────────────────────────── │ │
│  │ 自动备份-2026-07-10  自动  全量    50MB    已完成  今天02:00│ │
│  │ 茶信馆传奇-备份      手动  单剧本  5MB     已完成  今天10:00│ │
│  │ 项目A-完整备份      手动  项目    100MB   已完成  昨天15:00│ │
│  │ 自动备份-2026-07-09  自动  全量    45MB    已完成  昨天02:00│ │
│  │                                                         │ │
│  │ [恢复] [校验] [导出] [删除]                              │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 备份详情 ────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │ 备份：自动备份-2026-07-10                                │ │
│  │                                                         │ │
│  │ 基本信息：                                               │ │
│  │ - 类型：自动备份                                         │ │
│  │ - 范围：全量备份                                         │ │
│  │ - 大小：50MB                                            │ │
│  │ - 格式：JSON                                            │ │
│  │ - 校验：✅ 通过                                          │ │
│  │ - 创建时间：2026-07-10 02:00                             │ │
│  │                                                         │ │
│  │ 备份内容：                                               │ │
│  │ - 剧本：120个                                           │ │
│  │ - 角色：450个                                           │ │
│  │ - 场景：280个                                           │ │
│  │ - 评分记录：500条                                        │ │
│  │ - 审批记录：85条                                         │ │
│  │                                                         │ │
│  │ [恢复此备份] [校验完整性] [导出下载] [删除]               │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 验收标准

| 功能点 | 验收标准 |
|-------|---------|
| **自动备份** | ✅ 能按配置频率自动创建备份 |
| **手动备份** | ✅ 能手动创建全量/增量/单剧本备份 |
| **备份配置** | ✅ 能配置备份频率、范围、格式、保留策略 |
| **备份列表** | ✅ 能查看所有备份，包含名称、类型、大小、状态 |
| **备份详情** | ✅ 能查看备份的详细信息和内容列表 |
| **数据恢复** | ✅ 能成功恢复备份数据，支持覆盖或创建新副本 |
| **备份导出** | ✅ 能导出备份为可下载的文件格式 |
| **备份删除** | ✅ 能删除备份，释放存储空间 |
| **完整性校验** | ✅ 能校验备份数据的完整性和校验码 |
| **备份压缩** | ✅ 备份数据能正确压缩 |
| **备份加密** | ✅ 备份数据能正确加密 |
| **保留策略** | ✅ 自动清理过期备份 |

---

## 附录：数据库表结构扩展

### A. 剧本模板表 (script_template)

```sql
CREATE TABLE script_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- short_series, long_series, movie, etc.
  description TEXT,
  status TEXT NOT NULL, -- draft, active, archived, deprecated
  author TEXT,
  version INTEGER DEFAULT 1,
  content TEXT, -- JSON格式
  usageCount INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  tags TEXT, -- JSON数组
  isSystem BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### B. 剧本标签表 (script_tag)

```sql
CREATE TABLE script_tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- genre, style, theme, etc.
  color TEXT DEFAULT '#999999',
  description TEXT,
  icon TEXT,
  parentId TEXT,
  usageCount INTEGER DEFAULT 0,
  isSystem BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE script_tag_relation (
  id TEXT PRIMARY KEY,
  scriptId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scriptId) REFERENCES script(id),
  FOREIGN KEY (tagId) REFERENCES script_tag(id)
);
```

### C. 剧本分类表 (script_category)

```sql
CREATE TABLE script_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parentId TEXT,
  path TEXT, -- 分类路径
  level INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT,
  projectId TEXT,
  scriptCount INTEGER DEFAULT 0,
  order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE script_category_relation (
  id TEXT PRIMARY KEY,
  scriptId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scriptId) REFERENCES script(id),
  FOREIGN KEY (categoryId) REFERENCES script_category(id)
);
```

### D. 评分标准表 (evaluation_criteria)

```sql
CREATE TABLE evaluation_criteria (
  id TEXT PRIMARY KEY,
  dimension TEXT NOT NULL, -- plot, character, dialogue, etc.
  description TEXT,
  weight REAL NOT NULL, -- 权重百分比
  criteria TEXT, -- JSON格式的评分细则
  aiEnabled BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### E. 剧本评分表 (script_evaluation)

```sql
CREATE TABLE script_evaluation (
  id TEXT PRIMARY KEY,
  scriptId TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  type TEXT NOT NULL, -- ai, manual
  evaluator TEXT,
  dimensions TEXT, -- JSON数组
  totalScore REAL NOT NULL,
  grade TEXT NOT NULL, -- S, A, B, C, D, F
  suggestions TEXT, -- JSON数组
  created_at TEXT NOT NULL,
  FOREIGN KEY (scriptId) REFERENCES script(id)
);
```

### F. 审批流程模板表 (approval_workflow_template)

```sql
CREATE TABLE approval_workflow_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nodes TEXT, -- JSON数组
  enabled BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### G. 剧本审批表 (script_approval)

```sql
CREATE TABLE script_approval (
  id TEXT PRIMARY KEY,
  scriptId TEXT NOT NULL,
  applicant TEXT NOT NULL,
  status TEXT NOT NULL, -- draft, submitted, reviewing, etc.
  currentNode TEXT,
  workflowId TEXT NOT NULL,
  records TEXT, -- JSON数组
  comments TEXT, -- JSON数组
  version INTEGER DEFAULT 1,
  submitted_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (scriptId) REFERENCES script(id),
  FOREIGN KEY (workflowId) REFERENCES approval_workflow_template(id)
);
```

### H. 剧本备份表 (script_backup)

```sql
CREATE TABLE script_backup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- auto, manual, scheduled, export
  scope TEXT NOT NULL, -- full, incremental, script, project
  status TEXT NOT NULL, -- creating, completed, failed, etc.
  scriptId TEXT,
  projectId TEXT,
  backupPath TEXT NOT NULL,
  size INTEGER,
  checksum TEXT,
  format TEXT DEFAULT 'json',
  content TEXT, -- JSON格式
  systemVersion TEXT,
  createdBy TEXT,
  notes TEXT,
  retentionDays INTEGER DEFAULT 30,
  expiresAt TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### I. 备份配置表 (backup_config)

```sql
CREATE TABLE backup_config (
  id TEXT PRIMARY KEY,
  autoBackupEnabled BOOLEAN DEFAULT TRUE,
  backupFrequency INTEGER DEFAULT 1, -- 天数
  backupHour INTEGER DEFAULT 2, -- 小时
  backupScope TEXT DEFAULT 'full',
  backupFormat TEXT DEFAULT 'json',
  retentionPolicy TEXT, -- JSON格式
  storagePath TEXT DEFAULT '/data/backups',
  compressionEnabled BOOLEAN DEFAULT TRUE,
  encryptionEnabled BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 总结

本补充设计文档涵盖了剧本中心的6个重要功能模块：

| 设计点 | 优先级 | 核心价值 |
|-------|--------|---------|
| **剧本模板库** | P2 | 提升创作效率，降低新人上手门槛 |
| **剧本标签系统** | P1 | 支持多维度分类，提升检索效率 |
| **剧本分类管理** | P1 | 支持层级化组织，便于项目管理 |
| **剧本质量评估标准** | P1 | 建立质量标准，支持AI和人工评分 |
| **剧本审批流程** | P1 | 规范审批流程，提升协作效率 |
| **数据备份和恢复** | P2 | 保障数据安全，支持灾难恢复 |

所有设计点都包含完整的需求说明、数据模型、API接口、界面原型和验收标准，可直接用于后续开发实施。

---

**文档位置**: `d:\trae\manju\docs\script-center-supplement-designs.md`