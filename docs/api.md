# 接口说明

后端默认运行在：

```text
http://localhost:3000
```

所有 JSON API 通常返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败时：

```json
{
  "code": 1001,
  "message": "错误原因",
  "data": null
}
```

## 会话

- `GET /api/conversations`：获取历史会话。
- `GET /api/conversations?projectId={id}`：获取某个项目下的会话。
- `POST /api/conversations`：创建会话。
- `PUT /api/conversations/{id}`：更新会话标题、置顶、项目归属等。
- `DELETE /api/conversations/{id}`：删除会话及关联消息、图片任务、视频任务、收藏记录。
- `GET /api/conversations/{id}/messages`：获取某个会话的消息。

创建会话示例：

```json
{
  "title": "新的创作会话",
  "project_id": "p-xxx"
}
```

## 聊天

- `POST /api/chat`：发送聊天消息，使用 SSE 流式返回。
- `POST /api/chat/stop`：停止指定会话的流式生成。

聊天接口返回的是 `text/event-stream`，不是普通 JSON。

## 图片

- `POST /api/images/generate`：生成图片。
- `GET /api/images?conversationId={id}`：获取某个会话的图片任务。
- `GET /api/images/{id}`：获取图片任务详情。
- `DELETE /api/images/{id}`：删除图片任务记录。

生成图片示例：

```json
{
  "conversationId": "c-xxx",
  "prompt": "一张古风人物海报",
  "images": ["/media/uploads/2026-07-02/a.png"],
  "ratio": "9:16",
  "n": 1
}
```

## 视频

- `POST /api/videos/generate`：创建视频任务。
- `GET /api/videos?conversationId={id}`：获取某个会话的视频任务。
- `GET /api/videos/{id}`：查询视频任务详情。
- `DELETE /api/videos/{id}`：删除视频任务记录。

视频是异步任务，前端会轮询详情接口，直到 `status` 变成 `success` 或 `failed`。

## 项目

- `GET /api/projects`：获取项目列表。
- `POST /api/projects`：创建项目。
- `PUT /api/projects/{id}`：更新项目。
- `DELETE /api/projects/{id}`：删除项目。

创建项目示例：

```json
{
  "name": "短剧项目",
  "storage_mode": "existing",
  "storage_path": "client-a/short-video"
}
```

## 收藏

- `GET /api/favorites`：获取收藏列表。
- `POST /api/favorites`：添加收藏。
- `DELETE /api/favorites/{id}`：取消收藏。

## 文件上传和媒体访问

- `POST /api/uploads`：上传图片附件。
- `GET /media/...`：访问全局媒体文件。
- `GET /project-media/{projectId}/...`：访问项目媒体文件。
