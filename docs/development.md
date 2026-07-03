# 开发和排错

这份文档说明日常开发怎么启动、怎么验证、出错时先看哪里。

## 启动

推荐用根目录脚本：

```bat
start-all.bat
```

它会先检查端口占用，再启动：

- 后端：`http://localhost:3000`
- 前端：`http://localhost:3001`

单独启动：

```bat
start-backend.bat
start-frontend.bat
```

## 热更新

前端使用 Next.js 开发服务器，改 `frontend/app/page.tsx`、CSS、组件后通常会自动刷新。

后端当前是 TypeScript 编译后运行。改后端代码后需要重启后端，或者执行：

```bat
cd backend
npm run start:dev
```

## 验证

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

## 日志

后端请求日志会写到：

```text
backend/data/logs/YYYY-MM-DD.log
```

如果前端报 `Failed to fetch`，先看：

1. 后端是否启动。
2. 浏览器能否访问 `http://localhost:3000/api/conversations`。
3. `backend/data/logs/` 里有没有错误堆栈。

## 常见问题

### Unexpected token 'I', "Internal S"... is not valid JSON

说明前端本来期待 JSON，但后端返回了 `Internal Server Error` 之类的 HTML 或纯文本。

先看后端终端和 `backend/data/logs/`，通常是后端抛错。

### Failed to proxy 或 socket hang up

通常是后端进程崩了、端口不对，或者请求过程中后端重启。

先重启后端，再刷新前端页面。

### Next.js __webpack_modules__ 报错

通常是 Next 缓存损坏。

处理方式：

```bat
node scripts\clean-next-cache.mjs
start-frontend.bat
```

### 图片或视频生成失败

检查：

1. `backend/.env` 是否有 `AGNES_API_KEY`。
2. `AGNES_USE_REAL_API` 是否为 `true`。
3. Agnes 接口路径是否和官方文档一致。
4. 后端日志中真实接口返回的错误。

## 改功能时看哪里

- 改页面布局：`frontend/app/page.tsx`
- 改图片详情页：`frontend/app/images/[id]/page.tsx`
- 改视频详情页：`frontend/app/videos/[id]/page.tsx`
- 改接口路由：`backend/src/http/router.ts`
- 改聊天、图片、视频业务：`backend/src/services/domain.ts`
- 改本地文件保存：`backend/src/services/media.ts`
- 改 CSV 字段：`backend/src/storage/schema.ts`
- 改 CSV 读写逻辑：`backend/src/storage/csv.ts`
