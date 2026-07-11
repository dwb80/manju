# API接口文档（API Specification）

> 本文档定义《AI漫剧项目管理系统》V1.0的前后端API接口规范,包括RESTful API设计、请求响应格式、错误处理机制。

---

## API设计原则

### 1. RESTful API规范

- 使用HTTP标准方法(GET/POST/PUT/DELETE)
- 资源命名使用复数名词(如/projects, /episodes)
- URL层级不超过3级(如/projects/{id}/episodes/{id})
- 使用HTTP状态码表示结果(200/400/401/403/404/500)

### 2. 认证与授权

- 使用JWT Token认证
- Token放置在Authorization Header: `Bearer {token}`
- 所有API(除登录注册外)都需要验证Token
- Token过期时间:24小时,支持刷新Token(7天)

### 3. 数据格式

- 请求:JSON格式(Content-Type: application/json)
- 响应:JSON格式
- 时间格式:ISO 8601(2026-07-09T10:30:00Z)
- 文件上传:multipart/form-data

---

## API接口清单

### 1. 项目管理API

#### 1.1 创建项目

```http
POST /api/v1/projects
Authorization: Bearer {token}

Request Body:
{
  "name": "灵契界",
  "description": "古风玄幻漫剧项目",
  "season": "2026-Q1",
  "owner_id": 1,
  "budget": 50000.00,
  "ai_budget": 5000.00,
  "start_date": "2026-07-01",
  "end_date": "2026-12-31"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "project_code": "PRJ-20260709-001",
    "name": "灵契界",
    "status": "规划中",
    "created_at": "2026-07-09T10:30:00Z"
  },
  "message": "项目创建成功"
}

Response 400:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "项目名称必填",
    "details": {"field": "name", "constraint": "NOT_NULL"}
  }
}
```

#### 1.2 获取项目列表

```http
GET /api/v1/projects?page=1&limit=20&status=制作中
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "project_code": "PRJ-20260709-001",
        "name": "灵契界",
        "status": "制作中",
        "owner_name": "张导演",
        "ai_cost_used": 1500.00,
        "ai_budget": 5000.00,
        "created_at": "2026-07-09T10:30:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

#### 1.3 获取项目详情

```http
GET /api/v1/projects/{id}
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "project_code": "PRJ-20260709-001",
    "name": "灵契界",
    "description": "古风玄幻漫剧项目",
    "status": "制作中",
    "season": "2026-Q1",
    "owner": {"id": 1, "name": "张导演"},
    "episodes_count": 10,
    "storyboards_count": 150,
    "ai_cost_used": 1500.00,
    "ai_budget": 5000.00,
    "members": [
      {"id": 2, "name": "李编剧", "role": "编剧"},
      {"id": 3, "name": "王美术", "role": "美术"}
    ],
    "created_at": "2026-07-09T10:30:00Z",
    "updated_at": "2026-07-09T12:00:00Z"
  }
}
```

---

### 2. 剧集管理API

#### 2.1 创建剧集

```http
POST /api/v1/projects/{project_id}/episodes
Authorization: Bearer {token}

Request Body:
{
  "episode_number": 1,
  "title": "第1集:退婚",
  "description": "开篇剧情,男主遭遇退婚危机"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "episode_code": "EP-1-001",
    "episode_number": 1,
    "title": "第1集:退婚",
    "status": "待编写",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

---

### 3. 剧本管理API

#### 3.1 创建剧本版本

```http
POST /api/v1/episodes/{episode_id}/scripts
Authorization: Bearer {token}

Request Body:
{
  "version": "v1.0",
  "version_note": "初始版本",
  "content": "剧本正文内容...",
  "characters": [
    {"name": "林逸", "role": "男主", "description": "古风少年"}
  ],
  "scenes": [
    {"name": "茶馆", "description": "古风茶馆场景"}
  ]
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "script_code": "SCR-1-v1.0",
    "version": "v1.0",
    "is_current": true,
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

---

### 4. 分镜管理API

#### 4.1 创建分镜

```http
POST /api/v1/episodes/{episode_id}/storyboards
Authorization: Bearer {token}

Request Body:
{
  "scene_number": 1,
  "shot_type": "中景",
  "angle": "平视",
  "camera_movement": "固定",
  "duration": 5,
  "description": "林逸走进茶馆",
  "character_ids": [1, 2],
  "scene_id": 1
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "storyboard_code": "SB-1-001",
    "scene_number": 1,
    "status": "待制作",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

---

### 5. AI图片生成API

#### 5.1 提交图片生成任务

```http
POST /api/v1/ai/image/generate
Authorization: Bearer {token}

Request Body:
{
  "storyboard_id": 1,
  "model_provider": "agnes",
  "model_name": "flux-schnell",
  "prompt": "古风少年走进茶馆,中景,平视,固定镜头...",
  "reference_images": ["http://example.com/ref1.jpg"],
  "parameters": {
    "resolution": "1024x1024",
    "num_inference_steps": 20,
    "guidance_scale": 7.5,
    "num_outputs": 4
  }
}

Response 200:
{
  "success": true,
  "data": {
    "task_id": 1,
    "task_code": "AI-IMG-001",
    "status": "排队中",
    "estimated_time": 30,
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 5.2 查询图片生成任务状态

```http
GET /api/v1/ai/image/tasks/{task_id}
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "task_id": 1,
    "task_code": "AI-IMG-001",
    "status": "已完成",
    "progress": 100,
    "outputs": [
      {"url": "http://example.com/img1.jpg", "id": 101},
      {"url": "http://example.com/img2.jpg", "id": 102},
      {"url": "http://example.com/img3.jpg", "id": 103},
      {"url": "http://example.com/img4.jpg", "id": 104}
    ],
    "cost": 0.50,
    "duration": 28,
    "completed_at": "2026-07-09T10:30:28Z"
  }
}
```

---

### 6. AI视频生成API

#### 6.1 提交视频生成任务

```http
POST /api/v1/ai/video/generate
Authorization: Bearer {token}

Request Body:
{
  "storyboard_id": 1,
  "model_provider": "agnes",
  "model_name": "agnes-video-v2.0",
  "image_url": "http://example.com/img1.jpg",
  "parameters": {
    "duration": 5,
    "motion_type": "镜头推近",
    "motion_strength": 50,
    "prompt": "镜头缓慢推近,人物轻微移动"
  }
}

Response 200:
{
  "success": true,
  "data": {
    "task_id": 1,
    "task_code": "AI-VID-001",
    "status": "排队中",
    "estimated_time": 180,
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 6.2 查询视频生成任务状态

```http
GET /api/v1/ai/video/tasks/{task_id}
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "task_id": 1,
    "task_code": "AI-VID-001",
    "status": "已完成",
    "progress": 100,
    "output": {
      "url": "http://example.com/vid1.mp4",
      "duration": 5,
      "resolution": "1024x1024",
      "file_size": 10485760
    },
    "cost": 1.50,
    "duration": 175,
    "completed_at": "2026-07-09T10:32:55Z"
  }
}
```

---

### 7. 资产管理API

#### 7.1 上传资产

```http
POST /api/v1/assets/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

Request Body:
{
  "project_id": 1,
  "asset_type": "image",
  "name": "林逸正面图",
  "file": <binary data>
}

Response 200:
{
  "success": true,
  "data": {
    "asset_id": 1,
    "asset_code": "ASSET-IMG-001",
    "name": "林逸正面图",
    "file_url": "http://example.com/assets/img1.jpg",
    "file_size": 5242880,
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

---

### 8. 审核管理API

#### 8.1 提交审核

```http
POST /api/v1/reviews
Authorization: Bearer {token}

Request Body:
{
  "asset_id": 1,
  "review_type": "图片审核",
  "notes": "风格符合预期,建议通过"
}

Response 200:
{
  "success": true,
  "data": {
    "review_id": 1,
    "status": "待审核",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 8.2 审核通过/驳回

```http
PUT /api/v1/reviews/{review_id}
Authorization: Bearer {token}

Request Body:
{
  "status": "审核通过",
  "result": "内容合规,质量良好"
}

Response 200:
{
  "success": true,
  "data": {
    "review_id": 1,
    "status": "审核通过",
    "reviewer_id": 5,
    "review_time": "2026-07-09T11:00:00Z"
  }
}
```

---

### 9. 项目任务管理API

#### 9.1 创建项目任务

```http
POST /api/v1/projects/{project_id}/tasks
Authorization: Bearer {token}

Request Body:
{
  "title": "完成第1集剧本",
  "status": "todo",
  "owner": "张编剧",
  "due_date": "2026-07-15",
  "notes": "需要在本周完成第1集剧本的初稿"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "task-uuid-001",
    "title": "完成第1集剧本",
    "status": "todo",
    "owner": "张编剧",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 9.2 获取项目任务列表

```http
GET /api/v1/projects/{project_id}/tasks?status=todo&owner=张编剧
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-uuid-001",
        "title": "完成第1集剧本",
        "status": "todo",
        "owner": "张编剧",
        "due_date": "2026-07-15",
        "created_at": "2026-07-09T10:30:00Z"
      }
    ],
    "total": 10,
    "todo_count": 5,
    "done_count": 3
  }
}
```

#### 9.3 更新任务状态

```http
PUT /api/v1/tasks/{task_id}
Authorization: Bearer {token}

Request Body:
{
  "status": "done",
  "notes": "剧本已完成初稿"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "task-uuid-001",
    "status": "done",
    "updated_at": "2026-07-09T11:00:00Z"
  }
}
```

---

### 10. 项目问题管理API

#### 10.1 创建项目问题

```http
POST /api/v1/projects/{project_id}/issues
Authorization: Bearer {token}

Request Body:
{
  "title": "角色风格不一致",
  "severity": "high",
  "status": "open",
  "owner": "王美术",
  "target_type": "storyboard",
  "target_id": "sb-uuid-001",
  "notes": "第5个分镜的角色与前面分镜风格不一致"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "issue-uuid-001",
    "title": "角色风格不一致",
    "severity": "high",
    "status": "open",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 10.2 获取项目问题列表

```http
GET /api/v1/projects/{project_id}/issues?status=open&severity=high
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": "issue-uuid-001",
        "title": "角色风格不一致",
        "severity": "high",
        "status": "open",
        "owner": "王美术",
        "target_type": "storyboard",
        "target_id": "sb-uuid-001",
        "created_at": "2026-07-09T10:30:00Z"
      }
    ],
    "total": 5,
    "open_count": 3,
    "critical_count": 1
  }
}
```

#### 10.3 更新问题状态

```http
PUT /api/v1/issues/{issue_id}
Authorization: Bearer {token}

Request Body:
{
  "status": "resolved",
  "notes": "已重新生成角色图片,风格一致"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "issue-uuid-001",
    "status": "resolved",
    "updated_at": "2026-07-09T11:00:00Z"
  }
}
```

---

### 11. 项目里程碑管理API

#### 11.1 创建项目里程碑

```http
POST /api/v1/projects/{project_id}/milestones
Authorization: Bearer {token}

Request Body:
{
  "title": "第1集制作完成",
  "status": "planned",
  "owner": "张导演",
  "due_date": "2026-07-31",
  "description": "包含剧本、分镜、图片、视频全部完成"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "milestone-uuid-001",
    "title": "第1集制作完成",
    "status": "planned",
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 11.2 获取项目里程碑列表

```http
GET /api/v1/projects/{project_id}/milestones
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "milestones": [
      {
        "id": "milestone-uuid-001",
        "title": "第1集制作完成",
        "status": "planned",
        "owner": "张导演",
        "due_date": "2026-07-31",
        "created_at": "2026-07-09T10:30:00Z"
      }
    ],
    "total": 3,
    "done_count": 1,
    "delayed_count": 0
  }
}
```

#### 11.3 更新里程碑状态

```http
PUT /api/v1/milestones/{milestone_id}
Authorization: Bearer {token}

Request Body:
{
  "status": "done",
  "description": "第1集已全部完成并通过审核"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "milestone-uuid-001",
    "status": "done",
    "updated_at": "2026-07-09T11:00:00Z"
  }
}
```

---

### 12. 剪辑片段管理API

#### 12.1 创建剪辑片段

```http
POST /api/v1/projects/{project_id}/clips
Authorization: Bearer {token}

Request Body:
{
  "storyboard_id": "sb-uuid-001",
  "episode": 1,
  "scene": "SC001",
  "shot": "SHOT01",
  "title": "第1集开场镜头",
  "source_video_url": "http://example.com/video1.mp4",
  "duration": 5,
  "in_point": "00:00:00",
  "out_point": "00:00:05",
  "order_index": 1,
  "status": "todo"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "clip-uuid-001",
    "title": "第1集开场镜头",
    "duration": 5,
    "order_index": 1,
    "created_at": "2026-07-09T10:30:00Z"
  }
}
```

#### 12.2 获取剪辑片段列表

```http
GET /api/v1/projects/{project_id}/clips?episode=1&status=todo
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "clips": [
      {
        "id": "clip-uuid-001",
        "episode": 1,
        "scene": "SC001",
        "shot": "SHOT01",
        "title": "第1集开场镜头",
        "duration": 5,
        "order_index": 1,
        "status": "todo",
        "created_at": "2026-07-09T10:30:00Z"
      }
    ],
    "total": 10,
    "total_duration": 50,
    "todo_count": 5
  }
}
```

#### 12.3 更新剪辑片段排序

```http
PUT /api/v1/clips/{clip_id}
Authorization: Bearer {token}

Request Body:
{
  "order_index": 2,
  "status": "editing"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "clip-uuid-001",
    "order_index": 2,
    "status": "editing",
    "updated_at": "2026-07-09T11:00:00Z"
  }
}
```

#### 12.4 批量调整片段顺序

```http
PUT /api/v1/projects/{project_id}/clips/reorder
Authorization: Bearer {token}

Request Body:
{
  "clips": [
    {"id": "clip-uuid-001", "order_index": 1},
    {"id": "clip-uuid-002", "order_index": 2},
    {"id": "clip-uuid-003", "order_index": 3}
  ]
}

Response 200:
{
  "success": true,
  "data": {
    "updated_count": 3,
    "message": "片段顺序已更新"
  }
}
```

---

## API错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

### 错误码定义

| 错误码 | HTTP状态码 | 说明 | 示例场景 |
|-------|-----------|------|---------|
| **VALIDATION_ERROR** | 400 | 数据验证失败 | 字段缺失/格式错误 |
| **AUTHENTICATION_ERROR** | 401 | 认证失败 | Token无效/过期 |
| **AUTHORIZATION_ERROR** | 403 | 权限不足 | 无项目访问权限 |
| **NOT_FOUND** | 404 | 资源不存在 | 项目ID不存在 |
| **CONFLICT_ERROR** | 409 | 资源冲突 | 项目名称重复 |
| **RATE_LIMIT_ERROR** | 429 | 请求频率超限 | API调用过快 |
| **AI_SERVICE_ERROR** | 500 | AI服务错误 | API调用失败 |
| **DATABASE_ERROR** | 500 | 数据库错误 | 数据库连接失败 |
| **INTERNAL_ERROR** | 500 | 内部错误 | 未预期异常 |

---

## API文档生成工具

### Swagger/OpenAPI规范

```yaml
openapi: 3.0.0
info:
  title: AI漫剧项目管理系统API
  version: 1.0.0
  description: 企业级AI内容生产平台API接口

servers:
  - url: http://localhost:3001/api/v1
    description: 开发环境
  - url: https://api.example.com/api/v1
    description: 生产环境

paths:
  /projects:
    post:
      summary: 创建项目
      tags: [项目管理]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectCreateRequest'
      responses:
        '200':
          description: 项目创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectResponse'
        '400':
          description: 数据验证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    ProjectCreateRequest:
      type: object
      required: [name, season, owner_id]
      properties:
        name:
          type: string
          maxLength: 100
        description:
          type: string
          maxLength: 1000
        season:
          type: string
          pattern: '^\\d{4}-Q\\d$'

    ProjectResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          $ref: '#/components/schemas/Project'
        message:
          type: string

    Project:
      type: object
      properties:
        id:
          type: integer
        project_code:
          type: string
        name:
          type: string
        status:
          type: string
          enum: [规划中, 制作中, 审核中, 已完成, 已发布]
        created_at:
          type: string
          format: date-time

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: object
```

---

## API性能要求

| API类型 | 响应时间要求 | 并发要求 | 备注 |
|---------|------------|---------|------|
| 数据查询API | ≤500ms | 50并发 | 单表查询 |
| 数据写入API | ≤1秒 | 20并发 | 含事务 |
| AI生成任务提交 | ≤2秒 | 100并发 | 异步处理 |
| AI任务状态查询 | ≤200ms | 100并发 | 高频查询 |
| 文件上传API | ≤5秒 | 10并发 | 10MB文件 |

---

## 修改记录

| 日期 | 版本 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 2026-07-09 | v1.0 | 初始版本,定义8类核心API接口 | AI助手 |