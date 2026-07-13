# 前端API对接和测试数据创建执行方案

> 按照用户要求：完成API对接、创建测试数据、启动测试

---

## 📋 执行任务清单

### 任务1：完成前端页面API对接（进行中）

**需要修改的4个页面**：

| 页面 | 文件路径 | 需要调用的API | Mock数据位置 |
|------|---------|--------------|-------------|
| **AI任务队列** | `app/ai-tasks/page.tsx` | `/api/ai/tasks` | 第45-132行 |
| **数据中心** | `app/data/page.tsx` | `/api/data/metrics`, `/api/data/ai-cost`, `/api/data/production-efficiency` | 第43-150行 |
| **模型中心** | `app/models/page.tsx` | `/api/models` | 第32-250行 |
| **发布中心** | `app/publish/page.tsx` | `/api/publish/videos`, `/api/publish/plans` | 第43-200行 |

---

### 任务2：创建测试数据脚本（待执行）

**测试数据类型**：
1. **项目数据**：创建2-3个测试项目
2. **会话数据**：创建5-10个测试会话
3. **AI任务数据**：
   - 图片生成任务：10-15个（不同状态）
   - 视频生成任务：5-10个（不同状态）
4. **剧本和分镜数据**：每个项目创建剧本和分镜
5. **资产数据**：创建角色和场景资产
6. **审核数据**：创建审核记录
7. **发布计划数据**：创建发布计划

---

### 任务3：启动服务器测试（待执行）

**测试流程**：
1. 启动后端服务器
2. 执行测试数据脚本
3. 启动前端开发服务器
4. 访问所有新页面验证功能

---

## 🔧 API对接具体方案

### 1. AI任务队列页面

**修改策略**：
- 保留现有的UI和样式
- 删除Mock数据定义（第45-132行）
- 添加真实API调用函数
- 使用useEffect加载数据
- 实现刷新、取消、重试等操作的真实API调用

**API调用函数**：
```typescript
// 获取任务列表
async function fetchTasks(filters) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/ai/tasks?${params}`);
  return response.json();
}

// 批量取消任务
async function cancelTasks(taskIds) {
  const response = await fetch('/api/ai/tasks/cancel', {
    method: 'POST',
    body: JSON.stringify({ taskIds })
  });
  return response.json();
}

// 批量重试任务
async function retryTasks(taskIds) {
  const response = await fetch('/api/ai/tasks/retry', {
    method: 'POST',
    body: JSON.stringify({ taskIds })
  });
  return response.json();
}

// 删除任务
async function deleteTask(id) {
  const response = await fetch(`/api/ai/tasks/${id}`, {
    method: 'DELETE'
  });
  return response.json();
}
```

---

### 2. 数据中心页面

**修改策略**：
- 删除Mock数据定义（第43-150行）
- 添加真实API调用
- 实现时间范围筛选的真实功能
- 数据刷新功能

**API调用函数**：
```typescript
// 获取数据概览
async function fetchMetrics(timeRange) {
  const response = await fetch(`/api/data/metrics?timeRange=${timeRange}`);
  return response.json();
}

// 获取AI成本统计
async function fetchAiCost(timeRange) {
  const response = await fetch(`/api/data/ai-cost?timeRange=${timeRange}`);
  return response.json();
}

// 获取生产效率数据
async function fetchProductionEfficiency(timeRange) {
  const response = await fetch(`/api/data/production-efficiency?timeRange=${timeRange}`);
  return response.json();
}
```

---

### 3. 模型中心页面

**修改策略**：
- 删除Mock数据定义（第32-250行）
- 添加真实API调用
- 实现设置默认模型功能

**API调用函数**：
```typescript
// 获取模型列表
async function fetchModels() {
  const response = await fetch('/api/models');
  return response.json();
}

// 设置默认模型
async function setDefaultModel(id) {
  const response = await fetch(`/api/models/${id}/set-default`, {
    method: 'POST'
  });
  return response.json();
}
```

---

### 4. 发布中心页面

**修改策略**：
- 删除Mock数据定义（第43-200行）
- 添加真实API调用
- 实现发布计划管理功能

**API调用函数**：
```typescript
// 获取成片列表
async function fetchVideos(filters) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/publish/videos?${params}`);
  return response.json();
}

// 获取发布计划
async function fetchPlans(status) {
  const params = status ? `?status=${status}` : '';
  const response = await fetch(`/api/publish/plans${params}`);
  return response.json();
}

// 创建发布计划
async function createPlan(planData) {
  const response = await fetch('/api/publish/plans', {
    method: 'POST',
    body: JSON.stringify(planData)
  });
  return response.json();
}
```

---

## 💾 测试数据创建方案

### 测试数据脚本结构

**文件路径**：`backend/scripts/create-test-data.ts`

**数据创建顺序**：
1. 创建用户（如果需要）
2. 创建项目
3. 创建会话（关联项目）
4. 创建AI任务（图片+视频）
5. 创建剧本和分镜
6. 创建资产数据
7. 创建审核记录
8. 创建发布计划

---

### 具体测试数据内容

#### 1. 项目数据（2个）
```typescript
const testProjects = [
  {
    name: "测试漫剧-科幻系列",
    description: "一个关于未来世界的科幻漫剧",
    status: "production"
  },
  {
    name: "测试漫剧-爱情故事",
    description: "一个温馨的爱情故事漫剧",
    status: "production"
  }
];
```

---

#### 2. 会话数据（8个）
```typescript
// 每个项目创建4个会话
// 用于AI生成任务
```

---

#### 3. AI任务数据

**图片任务（15个）**：
- 状态分布：completed(8), in_progress(2), queued(2), failed(3)
- 分配到不同会话

**视频任务（8个）**：
- 状态分布：completed(5), in_progress(2), failed(1)
- 分配到不同会话

---

#### 4. 剧本和分镜数据
- 每个项目创建1-2个剧本版本
- 每个剧本拆解生成10-15个分镜

---

#### 5. 资产数据
- 创建5-8个角色资产
- 创建5-8个场景资产

---

#### 6. 审核数据
- 创建5-10个审核记录
- 不同审核状态

---

#### 7. 发布计划数据（3个）
```typescript
const testPublishPlans = [
  {
    name: "科幻系列发布计划",
    status: "planning",
    plannedDate: new Date(Date.now() + 7*24*60*60*1000), // 7天后
    platforms: ["youtube", "bilibili"]
  },
  {
    name: "爱情故事第一阶段发布",
    status: "in_progress",
    plannedDate: new Date(Date.now() + 3*24*60*60*1000), // 3天后
    platforms: ["douyin", "kuaishou"]
  },
  {
    name: "科幻系列第二阶段",
    status: "completed",
    plannedDate: new Date(Date.now() - 2*24*60*60*1000), // 2天前
    platforms: ["youtube"]
  }
];
```

---

## 🚀 执行计划

### 步骤1：完成前端API对接（当前）
- 修改4个页面文件
- 删除Mock数据
- 添加真实API调用
- 保持UI不变

---

### 步骤2：创建测试数据脚本（下一步）
- 创建 `backend/scripts/create-test-data.ts`
- 编写数据创建逻辑
- 确保数据完整性

---

### 步骤3：启动测试（最后）
- 启动后端：`cd backend && npm run dev`
- 运行测试脚本：`npm run create-test-data`
- 启动前端：`cd frontend && npm run dev`
- 访问页面验证功能

---

## 📊 预期测试数据量

| 数据类型 | 数量 | 说明 |
|---------|------|------|
| **项目** | 2个 | 科幻+爱情 |
| **会话** | 8个 | 每项目4个 |
| **图片任务** | 15个 | 多种状态 |
| **视频任务** | 8个 | 多种状态 |
| **剧本** | 4个 | 每项目2个 |
| **分镜** | 20-30个 | 每剧本5-8个 |
| **角色资产** | 8个 | 不同角色 |
| **场景资产** | 8个 | 不同场景 |
| **审核记录** | 8个 | 不同状态 |
| **发布计划** | 3个 | 不同阶段 |

---

## ✅ 完成验收标准

1. **前端API对接完成**：
   - 所有页面使用真实API
   - 无Mock数据残留
   - 功能正常工作

2. **测试数据创建完成**：
   - 脚本执行成功
   - 数据库有测试数据
   - 数据关系完整

3. **功能测试通过**：
   - 所有页面可访问
   - 数据正常显示
   - 操作功能正常

---

## 修改记录

| 日期 | 版本 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 2026-07-09 | v1.0 | 初始版本,制定执行方案 | AI助手 |