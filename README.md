# Agnes AI Studio

Agnes AI Studio 是一个本地运行的 AI 创作工具，支持聊天、图片生成、视频生成、历史会话、收藏、项目归属和本地媒体保存。

这个项目是前后端分离结构：

- `backend/`：Node.js 后端，负责 API、Agnes 接口调用、SQLite 数据存储、本地图片/视频缓存。
- `frontend/`：Next.js + React + Tailwind 前端，负责聊天页面、图片页、视频页和历史会话列表。
- `docs/`：给开发者和新手看的说明文档。
- `start-all.bat`：一键启动前端和后端。

## 快速运行

先分别安装依赖：

```bat
cd backend
npm install

cd ..\frontend
npm install
```

配置 API Key：

```bat
backend\.env
```

示例：

```env
AGNES_API_KEY=你的_key
AGNES_API_BASE_URL=https://apihub.agnes-ai.com
```

启动：

```bat
start-all.bat
```

访问：

- 前端：http://localhost:3001
- 后端：http://localhost:3000

## 新手先看这些

- [项目结构](docs/project-guide.md)
- [架构说明](docs/architecture.md)
- [数据和文件保存位置](docs/storage.md)
- [接口说明](docs/api.md)
- [开发和排错](docs/development.md)

## 常用命令

后端测试：

```bat
cd backend
npm test
```

前端构建：

```bat
cd frontend
npm run build
```

完整验证：

```bat
cd backend
npm run test:all
```

## 常见问题

如果页面提示 `Failed to fetch`，通常是后端没有启动，先看 `http://localhost:3000/api/conversations` 是否能访问。

如果生成图片或视频失败，先检查 `backend/.env` 里的 `AGNES_API_KEY` 和 Agnes 接口路径。

如果页面更新异常，停止前端后删除 `frontend/.next` 和 `frontend/.next-build`，再重新启动。
