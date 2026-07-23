# SEC-SUP-02 软件物料清单（SBOM）实施文档

> 章节：§8.13 SEC 供应链 / SOP-02 SBOM 生成  
> 状态：✅ P2 完成（2026-07-23 W16 实施）  
> 配套：`.github/workflows/sbom.yml` + `scripts/generate-sbom.mjs` + `artifacts/sbom/*.cdx.json`

## 1. 目标

- **可追溯性**：每个构建产物对应一份 CycloneDX 1.5 标准的 SBOM，覆盖 backend / frontend 两个工作区。
- **应急响应**：在 CVE 披露时，10 分钟内可基于 SBOM 命中受影响版本。
- **合规**：满足等保 2.0 八大类中"安全建设管理 - 供应链"和 SOC 2 CC7.1 / CC8.1 控制要求。
- **可重放**：CI 定时 + 每次 push/PR 自动生成，90 天 retention。

## 2. 选型与权衡

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| `@cyclonedx/cyclonedx-npm` | 官方维护、字段完整 | 引入第三方依赖 + 网络下载、版本升级风险 | ❌ 弃用 |
| `cdxgen` | 多语言、产出 SPDX/CycloneDX | 二进制依赖（Node/Java/Python 混合），CI 体积大 | ❌ 弃用 |
| **自研解析 `package-lock.json`** | 零依赖、30 行可读、可控字段、跟随 lockfile 严格生成 | 字段较简（无 CPE / 无 License 全文） | ✅ 采用 |

**采用自研方案**：
- 解析 `package.json` + `package-lock.json` v3 的 `packages` 字段
- 输出 CycloneDX 1.5 JSON（`specVersion: 1.5`）
- 字段：`metadata.component` + `components[]` + `dependencies[]` + `properties[manju:workspace, manju:depth, manju:pinned]`
- `purl` 格式：`pkg:npm/<name>@<version>`
- `hash.alg = SHA-1`（按 name@version 派生，仅用于完整性标识）
- 不含 CPE / License 全文（如下游需要可后续扩展为 PURL+CPE 双标签）

## 3. 文件结构

```
.
├── scripts/
│   └── generate-sbom.mjs              # 本地/CI 通用生成脚本
├── .github/workflows/
│   └── sbom.yml                       # 自动化工作流
├── artifacts/sbom/                    # 产物（CI 上传 90 天）
│   ├── backend-sbom.cdx.json
│   └── frontend-sbom.cdx.json
└── docs/security/
    └── sbom.md                        # 本文件
```

## 4. 用法

### 4.1 本地生成

```bash
# 在仓库根目录
node scripts/generate-sbom.mjs backend frontend

# 仅生成单个工作区
node scripts/generate-sbom.mjs backend
```

### 4.2 CI 触发

| 触发条件 | 行为 |
|----------|------|
| push 到 main / release/* | 生成 + 上传 90 天 artifacts + 发布到 main 分支资产 |
| pull_request | 生成 + 上传 artifacts（不发布）+ 输出 step summary |
| 每周一 03:00 UTC | 定时生成，作为合规审计依据 |
| workflow_dispatch | 手动触发 |

### 4.3 验证产物

```bash
# 校验 JSON 合法
node -e "JSON.parse(require('fs').readFileSync('artifacts/sbom/backend-sbom.cdx.json', 'utf8'))"

# 查看组件数
node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/sbom/backend-sbom.cdx.json', 'utf8')).components.length)"

# 列出直接依赖
node -e "
  const b = JSON.parse(require('fs').readFileSync('artifacts/sbom/backend-sbom.cdx.json', 'utf8'));
  console.log(b.components.filter(c => c.properties?.find(p => p.name === 'manju:depth')?.value === 'direct').map(c => c.name + '@' + c.version).join('\n'));
"
```

## 5. 与其它安全控制的联动

| 控制 | 联动方式 |
|------|----------|
| **SEC-SUP-01** npm audit | `security.yml` 在 SBOM 之后跑 `npm audit --audit-level=high`，SBOM 提供受影响组件列表 |
| **SEC-SUP-03** Trivy 镜像扫描 | `trivy-scan.yml` 复用 SBOM 做镜像层差异分析（未来可加 `--sbom-src`） |
| **SEC-DATA-03** 数据备份 | SBOM 走 `actions/upload-artifact@v4` 90 天 retention，备份/恢复链路已包含 |
| **SEC-OPS-02** 等保 2.0 路线图 | SBOM 命中"安全建设管理 - 供应链"控制项 |

## 6. 已知限制

1. **仅 npm 生态**：本项目当前只用 npm，未来若引入 pnpm / yarn 需要重写解析器。
2. **无 CPE / License 全文**：纯 PURL，可由下游消费方补全。
3. **无 SLSA provenance**：与 SLSA Level 2 仍差一步，需要 Sigstore / in-toto attestation（待规划）。
4. **未自动对 SBOM 做漏洞匹配**：当前是 `npm audit` 显式跑，未来可集成 OSV / Snyk 自动 diff。

## 7. 验收清单

- [x] `scripts/generate-sbom.mjs` 可在本地 Node.js 24 上运行
- [x] 产物符合 CycloneDX 1.5 规范
- [x] 产物包含 `metadata.tools` + `metadata.component` + `components[]` + `dependencies[]`
- [x] 90 天 retention artifacts
- [x] 每周一定时生成
- [x] 文档在 `docs/security/sbom.md`

## 8. 后续规划

- 集成 OSV API 自动 diff CVE（待排期）
- 与 SLSA Level 2 联动，加 Sigstore 签名
- 把 SBOM 写进 OCI 镜像 annotations（按镜像分发链路可追溯）
