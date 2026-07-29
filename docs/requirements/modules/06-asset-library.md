# 资产库使用说明

> **所属上下文**：[资产库 §3.4](../../domain/contexts/04-asset-library.md)

> 资产库是 [DDD 文档 §3.4 资产库上下文](../../domain/01-domain-requirements-spec.md) 的用户使用层入口。领域边界、聚合不变量、跨上下文引用规则以 DDD 文档为准。

资产库把图片、视频、角色、场景、风格、Prompt 模板、项目资料和分镜底图统一管理起来，方便后续生成图片、图生视频和剪辑交付。资产必须归属到某个项目；项目级可见性是资产库隔离的基本单位。

## 入口

在左侧选择一个具体项目后，进入主区域的 `项目工作台`，打开 `资产库` 页签。

> 项目可见性约束：项目归档后其资产对所有团队成员只读；项目删除（软删除）后资产仍保留在数据库中，UI 标记"项目已删除"。

## 支持的资产类型

- **图片资产**：生成图、上传图、参考图
- **视频资产**：生成视频、上传视频或外部视频链接
- **角色资产**：角色卡，用于保存角色参考图、角色描述、外观标签和固定 Prompt
- **场景资产**：场景卡，用于保存地点参考图、空间描述、时间气氛、光照和场景固定 Prompt
- **道具资产**：道具卡，用于保存道具参考图、材质形状、用途描述
- **风格资产**：画风模板，用于保存风格 Prompt、参考图、色调、光影和分镜风格
- **Prompt 模板资产**：可复用 Prompt 模板
- **项目资产**：剧本资料、世界观、设定文档等项目级资产
- **分镜底图**：每个分镜的底图或关键画面，可直接作为图生视频参考图

## 新建资产

常用字段：

- 名称：资产在列表中展示的标题
- 设定词 / 生成 Prompt：复用时会自动带入输入框
- 图片 / 参考图 URL：图片、角色、场景、风格、分镜底图常用
- 视频 URL：视频资产常用
- 文件夹：手工分类，例如 `角色/主角`、`场景/长街`、`第一集/分镜`
- 标签：用逗号分隔，例如 `主角, 定妆, 古风`
- 分辨率：图片或视频规格，例如 `1080P`
- 时长：视频资产时长，例如 `5秒`
- 角色特征：角色资产使用，例如 `长发, 白衣, 少年感`
- 风格关键词：风格或场景资产使用，例如 `雨夜, 暖光, 电影感`

保存后，资产记录会写入 SQLite 的 `project_assets` 表。

## 搜索和筛选

资产库顶部支持：

- 关键词搜索：按名称、Prompt、备注、文件夹和标签搜索
- 类型筛选：按图片、视频、角色、场景、风格、Prompt 模板等筛选
- 标签筛选：只显示包含指定标签的资产
- 收藏筛选：只显示已收藏资产

## 常用操作

- 收藏 / 取消收藏：点击资产卡片右侧星标
- 删除：删除资产库记录（软删除，可恢复）
- 复用：把资产 Prompt 追加到输入框，并把参考图带入附件区
- 用于视频：把图片、角色图、场景图或分镜底图作为视频参考图
- 复制 Prompt：复制资产保存的 prompt
- 设为参考图：把图片 URL 放入图片生成流程，适合二次编辑

## 角色资产

### 字段建议

角色资产相当于角色卡，建议这样填写：

- 名称：角色名
- 参考图 URL：角色主参考图
- 设定词 / 生成 Prompt：角色固定描述
- 角色特征：发型、脸型、服装、体态、标志物
- 标签：主角、反派、第一集等项目标签

复用角色资产时，系统会把角色 prompt 和参考图带入生成输入区，用于提升同一角色的一致性。

### 角色资产完整字段

> 本节是 `characters` / `character_image_history` 表字段的对外契约。代码与本文档必须严格一致。

| 分组 | 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|---|
| 基础 | `name` | ✓ | string | 角色名 |
| 基础 | `role` | ✓ | enum | 主角 / 配角 / 反派 / 次要 |
| 基础 | `gender` |  | enum | 男 / 女 / 其他 |
| 基础 | `age` |  | number | 年龄 |
| 基础 | `image` |  | url | 角色主图（与 image_history 主图同步） |
| 基础 | `tags` |  | string[] | 标签，逗号分隔 |
| 外貌 | `identity` |  | string | 身份（剑客 / 公主 / 侦探） |
| 外貌 | `face` |  | text | 面部特征（脸型 / 五官 / 肤色 / 瞳色 / 表情习惯） |
| 外貌 | `hair` |  | string | 发型（发型 / 发色 / 长度 / 特殊造型） |
| 外貌 | `body` |  | string | 身材（身高 / 胖瘦 / 体态特征） |
| 外貌 | `temperament` |  | string | 气质（优雅 / 粗犷 / 冷峻 / 活泼） |
| 服装 | `costume_name` |  | string | 服装名称（夜行衣 / 校服 / 铠甲） |
| 服装 | `costume_description` |  | text | 服装详细描述 |
| 服装 | `costume_color` |  | string | 服装颜色（玄黑 / 月白 / 藏青） |
| 服装 | `costume_material` |  | string | 服装材质（丝绸 / 皮革 / 金属 / 棉布） |
| 服装 | `costume_style` |  | string | 服装风格（古风 / 现代 / 民族风） |
| 服装 | `accessories` |  | string | 配饰，逗号分隔（玉佩 / 耳环 / 腰带） |
| 动作 | `emotion_states` |  | json | 情绪状态 JSON 数组 |
| 动作 | `action_assets` |  | json | 动作资产 JSON 数组 |
| 关系 | `relationships` |  | json | 角色关系 JSON 数组 |
| 出现 | `first_appearance` |  | string | 首次出现（EP01-Scene01） |
| 出现 | `dialogue_count` |  | number | 对白数量 |
| AI | `generation_prompt` |  | text | 生图 Prompt（用于 AI 生图的标准化 Prompt） |
| AI | `confidence` |  | enum | confirmed / inferred |
| 描述 | `description` |  | text | 角色描述（自由文本） |
| 描述 | `traits` |  | string | 性格特点，逗号分隔 |

### 角色图片多视图

一个角色可以有多张图片（多景别 / 多角度 / 多用途）。每张图片归类为：

- **景别**（`shot_type`）：远景 / 全景 / 中景 / 近景 / 特写 / 半身 / 全身
- **角度**（`angle`）：正面 / 侧面 / 背面 / 3/4 侧 / 俯视 / 仰视 / 鸟瞰
- **视图类型**（`view_type`）：定妆 / 表情 / 动作 / 场景适配
- **状态**：已设为资产（`is_applied=1`） / 历史（`is_applied=0`）
- **主图**：一个角色最多 1 张主图

完整 API 与字段见 [04-factories-assets-and-image-views.md](04-factories-assets-and-image-views.md)。

## 场景资产

### 字段建议

场景资产相当于场景卡，建议这样填写：

- 名称：场景名，例如 `雨夜长街`
- 参考图 URL：场景参考图或场景底图
- 设定词 / 生成 Prompt：空间结构、时代背景、建筑材质、天气、时间
- 风格关键词：光照、色调、分镜氛围，例如 `湿润石板路, 暖色窗光, 低机位`
- 标签：室外、夜景、第一集、常驻场景等

复用场景资产时，系统会把场景描述和参考图带入生成输入区，减少每条分镜重复描述场景的成本。

### 场景资产完整字段

| 分组 | 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|---|
| 基础 | `name` | ✓ | string | 场景名 |
| 基础 | `type` | ✓ | enum | 室内 / 室外 / 城市场景 / 自然场景 等 |
| 基础 | `image` |  | url | 场景主图 |
| 基础 | `tags` |  | string[] | 标签 |
| 基础 | `description` |  | text | 场景描述（自由文本） |
| 环境 | `lighting` |  | string | 光照（自然光 / 暖色窗光 / 霓虹） |
| 环境 | `time_of_day` |  | enum | 日出 / 日间 / 黄昏 / 夜晚 / 深夜 |
| 环境 | `weather` |  | enum | 晴 / 阴 / 雨 / 雪 / 雾 |
| AI 扩展 | `category` |  | string | 场景分类 |
| AI 扩展 | `indoor_outdoor` |  | enum | indoor / outdoor |
| AI 扩展 | `location` |  | string | 具体地点 |
| AI 扩展 | `architecture` |  | string | 建筑描述 |
| AI 扩展 | `terrain` |  | string | 地形 |
| AI 扩展 | `plants` |  | string | 植被 |
| AI 扩展 | `objects` |  | string | 关键物件 |
| AI 扩展 | `period` |  | string | 时代 |
| AI 扩展 | `tone` |  | string | 氛围基调 |
| AI 扩展 | `visual_style` |  | string | 视觉风格 |
| AI 扩展 | `atmosphere_emotion` |  | string | 氛围情感 |
| AI 扩展 | `suitable_shots` |  | string | 适用分镜 |
| AI 扩展 | `reusable_elements` |  | string | 可复用元素 |
| AI 扩展 | `generation_prompt` |  | text | 生图 Prompt |
| AI 扩展 | `first_appearance` |  | string | 首次出现 |
| AI 扩展 | `confidence` |  | enum | confirmed / inferred |

### 场景图片多视图

- **景别**（`shot_type`）：同角色
- **角度**（`angle`）：同角色
- **视图类型**（`view_type`）：整体 / 细节 / 转场
- 默认比例：16:9（横屏环境）

## 道具资产

### 字段建议

道具资产相当于道具卡。道具字段与角色 / 场景对仗：

- 名称：道具名
- 参考图 URL：道具主参考图
- 设定词 / 生成 Prompt：材质、形状、颜色、用途
- 标签：重要道具 / 第一集等

### 道具资产完整字段

| 分组 | 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|---|
| 基础 | `name` | ✓ | string | 道具名 |
| 基础 | `category` | ✓ | enum | 武器 / 服饰 / 食物 / 工具 / 文档 等 |
| 基础 | `image` |  | url | 道具主图 |
| 基础 | `tags` |  | string[] | 标签 |
| 基础 | `description` |  | text | 道具描述 |
| 外观 | `appearance` |  | text | 外观描述 |
| 外观 | `material` |  | string | 材质（木 / 铁 / 玉 / 布） |
| 外观 | `size` |  | string | 尺寸（小巧 / 适中 / 巨大） |
| 外观 | `color` |  | string | 颜色 |
| AI 扩展 | `importance_level` |  | enum | 关键 / 重要 / 一般 / 背景 |
| AI 扩展 | `owner` |  | string | 所属角色 |
| AI 扩展 | `shape` |  | string | 形状 |
| AI 扩展 | `texture` |  | string | 质感 |
| AI 扩展 | `story_function` |  | string | 剧情作用 |
| AI 扩展 | `visual_features` |  | string | 视觉特征 |
| AI 扩展 | `camera_usage` |  | string | 分镜使用建议 |
| AI 扩展 | `generation_prompt` |  | text | 生图 Prompt |
| AI 扩展 | `first_appearance` |  | string | 首次出现 |
| AI 扩展 | `confidence` |  | enum | confirmed / inferred |

### 道具图片多视图

- **景别 / 角度**：同角色
- **视图类型**（`view_type`）：单件 / 多角度 / 使用场景
- 默认比例：1:1（方形道具）

## 分镜底图

分镜底图适合保存每个分镜的关键画面，例如：

- 第一集第 1 镜开场底图
- 角色进入场景前的站位图
- 图生视频前需要锁定的构图参考

在资产卡片上点击 `用于视频`，系统会把底图放入视频生成附件区，并切换到视频生成页面。

## 数据位置

资产记录保存在 `project_assets` 表，图片历史在 `character_image_history` / `scene_image_history` / `prop_image_history`。

字段定义集中在 `backend/src/storage/schema.ts`；后端核心类型在 `backend/src/types.ts`；前端分类配置在 `frontend/lib/project-workflow.ts`。
