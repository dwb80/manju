# 🎬 AI Drama Studio - 全部模块页面设计方案

## 📋 设计概览

**设计日期**: 2026-07-09
**设计范围**: 左侧侧边栏所有菜单对应的模块页面
**设计状态**: 进行中
**总模块数**: 13个（含首页）

---

## 🎯 模块分类

### 📍 驾驶舱（1个模块）
- ✅ 首页驾驶舱（已完成）

### 🎨 AI生产中心（6个模块）
- ⏳ 剧本中心
- ⏳ 角色工厂
- ⏳ 场景工厂
- ⏳ 分镜导演台
- ⏳ 视频生产线
- ⏳ 音频中心

### 🛠️ 管理中心（5个模块）
- ⏳ 项目中心（已存在，需优化）
- ⏳ 审核中心
- ⏳ 资产中心
- ⏳ 模型中心（已存在，需优化）
- ⏳ 发布中心（已存在，需优化）

---

## 📐 统一设计框架

### 页面结构模板

```tsx
<PageContainer
  title="模块名称"
  description="模块描述"
>
  {/* 统计概览区 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      {/* 4个统计卡片 */}
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false}>
    <div className="flex justify-between">
      {/* 左侧：搜索、筛选 */}
      {/* 右侧：操作按钮 */}
    </div>
  </PageCard>

  {/* 内容区 */}
  <PageCard title="内容标题">
    {/* 主要内容 */}
  </PageCard>
</PageContainer>
```

---

## 🎨 1️⃣ 剧本中心（Scripts Center）

### 页面功能
- 剧本创作和管理
- AI辅助剧本生成
- 剧本版本控制
- 剧本协作编辑

### 页面布局

```tsx
<PageContainer
  title="剧本中心"
  description="创作和管理您的漫剧剧本"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="剧本总数" value="12" />
      <StatCard label="进行中" value="5" />
      <StatCard label="已完成" value="7" />
      <StatCard label="总字数" value="45,230" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索剧本..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>新建剧本</Button>
        <Button variant="outline">AI生成剧本</Button>
      </div>
    </div>
  </PageCard>

  {/* 剧本列表 */}
  <PageCard title="剧本列表">
    <div className="space-y-3">
      {/* 剧本卡片 */}
      <ScriptCard
        title="第一章：命运的相遇"
        status="进行中"
        words="5,230"
        lastEdited="2小时前"
      />
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface Script {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'writing' | 'review' | 'completed';
  words: number;
  chapters: number;
  created_at: string;
  updated_at: string;
  author: string;
  tags: string[];
}
```

---

## 🎭 2️⃣ 角色工厂（Character Factory）

### 页面功能
- 角色设计和生成
- 角色属性管理
- 角色关系图谱
- AI辅助角色生成

### 页面布局

```tsx
<PageContainer
  title="角色工厂"
  description="设计和生成漫剧角色"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="角色总数" value="35" />
      <StatCard label="主角" value="8" />
      <StatCard label="配角" value="27" />
      <StatCard label="AI生成" value="12" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索角色..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>新建角色</Button>
        <Button variant="outline">AI生成角色</Button>
      </div>
    </div>
  </PageCard>

  {/* 角色网格 */}
  <PageCard title="角色列表">
    <div className="grid grid-cols-4 gap-4">
      {/* 角色卡片 */}
      <CharacterCard
        name="林晓雪"
        role="主角"
        traits="坚强、勇敢、善良"
        image="/character1.jpg"
      />
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'supporting' | 'antagonist' | 'minor';
  traits: string[];
  description?: string;
  image?: string;
  age?: number;
  gender?: string;
  relationships: CharacterRelationship[];
  created_at: string;
  updated_at: string;
}
```

---

## 🎬 3️⃣ 场景工厂（Scene Factory）

### 页面功能
- 场景设计和生成
- 场景素材管理
- AI场景生成
- 场景复用

### 页面布局

```tsx
<PageContainer
  title="场景工厂"
  description="设计和生成漫剧场景"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="场景总数" value="28" />
      <StatCard label="室内场景" value="15" />
      <StatCard label="室外场景" value="13" />
      <StatCard label="AI生成" value="8" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索场景..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>新建场景</Button>
        <Button variant="outline">AI生成场景</Button>
      </div>
    </div>
  </PageCard>

  {/* 场景网格 */}
  <PageCard title="场景列表">
    <div className="grid grid-cols-3 gap-4">
      {/* 场景卡片 */}
      <SceneCard
        name="城市天台"
        type="室外"
        description="夜晚的城市天台，远处是繁华的都市夜景"
        image="/scene1.jpg"
      />
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface Scene {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'virtual';
  description: string;
  image?: string;
  tags: string[];
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 🎞️ 4️⃣ 分镜导演台（Storyboard Director）

### 页面功能
- 分镜设计和编排
- 时间轴管理
- 分镜预览
- AI辅助分镜生成

### 页面布局

```tsx
<PageContainer
  title="分镜导演台"
  description="设计和编排漫剧分镜"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="分镜总数" value="156" />
      <StatCard label="已完成" value="98" />
      <StatCard label="制作中" value="42" />
      <StatCard label="待审核" value="16" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索分镜..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>新建分镜</Button>
        <Button variant="outline">导入剧本</Button>
      </div>
    </div>
  </PageCard>

  {/* 分镜时间轴 */}
  <PageCard title="分镜时间轴">
    <div className="space-y-2">
      {/* 时间轴 */}
      <Timeline>
        <TimelineItem scene="场景1" shot="镜头1" duration="3s" />
      </Timeline>
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface Storyboard {
  id: string;
  scene_id: string;
  shot_number: number;
  description: string;
  duration: number; // 秒
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status: 'draft' | 'approved' | 'production' | 'completed';
  created_at: string;
  updated_at: string;
}
```

---

## 🎥 5️⃣ 视频生产线（Video Production Line）

### 页面功能
- 视频生成任务管理
- 视频素材编辑
- 视频质量检查
- 视频导出

### 页面布局

```tsx
<PageContainer
  title="视频生产线"
  description="管理视频生成和编辑流程"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="视频总数" value="45" />
      <StatCard label="生成中" value="3" />
      <StatCard label="已完成" value="40" />
      <StatCard label="总时长" value="2h 15m" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索视频..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>新建视频</Button>
        <Button variant="outline">批量导入</Button>
      </div>
    </div>
  </PageCard>

  {/* 视频列表 */}
  <PageCard title="视频任务">
    <div className="space-y-3">
      {/* 视频卡片 */}
      <VideoTaskCard
        title="场景1-镜头组合"
        status="processing"
        progress={65}
        duration="45s"
      />
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface VideoTask {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  duration: number; // 秒
  resolution?: string;
  fps?: number;
  format?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 🎵 6️⃣ 音频中心（Audio Center）

### 页面功能
- 音频生成和管理
- 背景音乐库
- 配音管理
- 音效素材

### 页面布局

```tsx
<PageContainer
  title="音频中心"
  description="管理音频素材和配音"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="音频总数" value="78" />
      <StatCard label="配音" value="32" />
      <StatCard label="背景音乐" value="28" />
      <StatCard label="音效" value="18" />
    </div>
  </PageCard>

  {/* 工具栏 */}
  <PageCard showBorder={false} className="mb-4">
    <div className="flex justify-between">
      <div className="flex gap-3">
        <SearchInput placeholder="搜索音频..." />
        <FilterSelect />
      </div>
      <div className="flex gap-2">
        <Button>上传音频</Button>
        <Button variant="outline">AI生成配音</Button>
      </div>
    </div>
  </PageCard>

  {/* 音频列表 */}
  <PageCard title="音频素材">
    <div className="space-y-2">
      {/* 音频项 */}
      <AudioItem
        name="林晓雪-经典台词"
        type="配音"
        duration="2:35"
        speaker="林晓雪"
      />
    </div>
  </PageCard>
</PageContainer>
```

### 数据结构

```typescript
interface AudioItem {
  id: string;
  name: string;
  type: 'voiceover' | 'bgm' | 'sfx';
  duration: number; // 秒
  file_url: string;
  speaker?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}
```

---

## ✅ 7️⃣ 审核中心（Review Center）

### 页面功能
- 内容审核队列
- 质量评分系统
- 审核意见记录
- 批量审核操作

### 页面布局

```tsx
<PageContainer
  title="审核中心"
  description="审核和管理生成内容"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="待审核" value="23" />
      <StatCard label="今日审核" value="15" />
      <StatCard label="通过率" value="87%" />
      <StatCard label="平均时长" value="2.5m" />
    </div>
  </PageCard>

  {/* 审核队列 */}
  <PageCard title="审核队列">
    <div className="space-y-3">
      {/* 审核卡片 */}
      <ReviewCard
        type="image"
        title="角色-林晓雪-正面形象"
        submittedBy="张三"
        submittedAt="10分钟前"
        onApprove={() => {}}
        onReject={() => {}}
      />
    </div>
  </PageCard>
</PageContainer>
```

---

## 📦 8️⃣ 资产中心（Assets Center）

### 页面功能
- 资产分类管理
- 资产搜索和筛选
- 资产版本控制
- 资产共享

### 页面布局

```tsx
<PageContainer
  title="资产中心"
  description="管理项目资产和素材"
>
  {/* 统计概览 */}
  <PageCard>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="资产总数" value="256" />
      <StatCard label="图片" value="128" />
      <StatCard label="视频" value="45" />
      <StatCard label="音频" value="83" />
    </div>
  </PageCard>

  {/* 资产网格 */}
  <PageCard title="资产列表">
    <div className="grid grid-cols-5 gap-4">
      {/* 资产卡片 */}
      <AssetCard
        name="林晓雪-正面照"
        type="image"
        size="2.3MB"
        preview="/asset1.jpg"
      />
    </div>
  </PageCard>
</PageContainer>
```

---

## 📊 设计实施计划

### 第一阶段：核心生产模块（优先）

| 模块 | 优先级 | 预估工时 |
|------|--------|----------|
| 剧本中心 | P0 | 2天 |
| 角色工厂 | P0 | 2天 |
| 场景工厂 | P0 | 1.5天 |
| 分镜导演台 | P0 | 2.5天 |
| 视频生产线 | P1 | 2天 |

### 第二阶段：辅助功能模块

| 模块 | 优先级 | 预估工时 |
|------|--------|----------|
| 音频中心 | P1 | 1天 |
| 审核中心 | P1 | 1.5天 |
| 资产中心 | P2 | 1天 |

---

## 📝 下一步行动

1. **创建页面文件**
   - 为每个模块创建独立的页面组件
   - 使用统一的PageContainer框架

2. **实现基础功能**
   - 数据展示
   - 搜索筛选
   - 基础操作

3. **优化用户体验**
   - 加载状态
   - 空状态设计
   - 错误处理

---

**设计文档版本**: v2.0
**最后更新**: 2026-07-09