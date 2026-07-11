# AI漫剧工业化生产平台 - 模型中心完整指南

> **文档版本**: V1.0  
> **最后更新**: 2026-07-10  
> **文档状态**: 待审核

---

## 目录

- [一、模块概述](#一模块概述)
- [二、Epic与Feature列表](#二epic与feature列表)
- [三、核心功能需求](#三核心功能需求)
- [四、数据模型设计](#四数据模型设计)
- [五、API集成设计](#五api集成设计)
- [六、UI设计与原型](#六ui设计与原型)
- [七、实施计划](#七实施计划)

---

## 一、模块概述

### 1.1 模块定位

**模型中心**是AI漫剧平台的核心基础设施，负责：
- 管理所有AI模型（聊天、图片、视频）
- 提供模型配置和参数管理
- 支持智能模型选择策略
- 记录模型调用和成本统计
- 管理模型能力标签和权限控制

### 1.2 核心价值

| 角色 | 核心价值 |
|------|---------|
| **编剧** | 无需懂模型细节，系统自动推荐最佳模型 |
| **美术** | 可切换图片模型，满足不同风格需求 |
| **导演** | 可控制视频模型质量和一致性 |
| **管理员** | 控制成本、质量和企业模型池 |
| **企业** | 不被单一模型绑定，灵活切换 |

### 1.3 设计原则

**核心原则**: **任务优先，而不是模型优先**

```
用户创建任务 → 系统识别任务类型 → 自动匹配推荐模型 → 生成结果
```

- ✅ 普通用户使用智能模式（自动选择）
- ✅ 专业用户使用专家模式（手动选择）
- ✅ 管理员使用管理模式（配置策略）

---

### 1.4 支持的模型类型

| 类型 | 模型名称 | 用途 | 特点 |
|------|---------|------|------|
| **聊天模型** | Agnes 2.0 Flash | 剧本创作、剧情分析、分镜拆解 | 512K上下文、视觉理解、Thinking模式 |
| **图片模型** | Agnes Image 2.1 Flash | 角色设计、场景设计、分镜图 | 图生图、关键帧模式、高信息密度 |
| **视频模型** | Agnes Video V2.0 | 图生视频、文生视频、关键帧模式 | 异步生成、帧数约束、一致性控制 |

---

## 二、Epic与Feature列表

### Epic 1: 模型注册与管理
- **Feature 1.1**: 模型注册与配置
- **Feature 1.2**: 模型能力标签管理
- **Feature 1.3**: 模型参数配置管理
- **Feature 1.4**: 模型API配置管理

### Epic 2: 模型选择策略
- **Feature 2.1**: 智能模式（自动推荐）
- **Feature 2.2**: 专家模式（手动选择）
- **Feature 2.3**: 管理员模式（策略配置）
- **Feature 2.4**: 默认模型设置

### Epic 3: 模型调用与记录
- **Feature 3.1**: 模型调用接口
- **Feature 3.2**: 调用参数验证
- **Feature 3.3**: 调用记录保存
- **Feature 3.4**: 异步任务管理（视频模型）

### Epic 4: 统计与分析
- **Feature 4.1**: 调用统计
- **Feature 4.2**: 成本统计
- **Feature 4.3**: 性能分析
- **Feature 4.4**: 模型评分系统

### Epic 5: 权限与控制
- **Feature 5.1**: 模型访问权限
- **Feature 5.2**: 用户配额限制
- **Feature 5.3**: 成本预算控制
- **Feature 5.4**: 企业模型池管理

---

## 三、核心功能需求

---

### Epic 1: 模型注册与管理

---

#### Feature 1.1: 模型注册与配置

**需求ID**: MODEL-REG-001  
**需求名称**: 模型注册与配置  
**功能描述**: 支持管理员注册新的AI模型，配置模型基本信息、参数和能力标签  
**触发条件**: 管理员在模型中心点击"添加模型"按钮  
**前置条件**: 用户具有管理员权限  

**操作步骤**:
1. 管理员点击"添加模型"
2. 系统弹出模型注册对话框
3. 管理员填写基本信息：
   - 模型ID（唯一标识）
   - 模型名称
   - 模型类型（chat/image/video）
   - 模型描述
   - 模型版本
   - 提供商
4. 管理员配置API信息：
   - API Endpoint
   - HTTP方法（POST/GET）
   - 自定义请求头
   - 状态查询Endpoint（视频模型）
5. 管理员配置能力标签：
   - 视觉理解支持（聊天模型）
   - Thinking模式支持（聊天模型）
   - 工具调用支持（聊天模型）
   - 流式响应支持（聊天模型）
   - 图生图支持（图片模型）
   - 关键帧模式支持（图片/视频模型）
   - 图生视频支持（视频模型）
   - 异步生成支持（视频模型）
6. 管理员配置参数：
   - 最大上下文长度（聊天模型）
   - 最大输出token数（聊天模型）
   - 默认温度（聊天模型）
   - 支持的图片尺寸（图片模型）
   - 默认推理步数（图片模型）
   - 支持的返回格式（图片模型）
   - 支持的视频比例（视频模型）
   - 最大视频时长（视频模型）
   - 最大帧数（视频模型）
   - 帧率范围（视频模型）
7. 管理员配置参数约束规则：
   - 帧数约束（8n+1规则）
   - 其他参数约束
8. 管理员配置价格信息：
   - 标准价格
   - 当前价格
9. 系统验证配置完整性
10. 系统保存模型配置

**正常流程**:
- 支持三种模型类型的注册：
  
  **聊天模型配置示例**:
  ```typescript
  {
    id: "agnes-2.0-flash",
    name: "Agnes 2.0 Flash",
    type: "chat",
    description: "快速响应的聊天模型，支持视觉理解和Thinking模式",
    version: "2.0",
    provider: "Agnes AI",
    apiConfig: {
      endpoint: "https://apihub.agnes-ai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
      }
    },
    capabilities: {
      visionSupport: true,
      thinkingMode: true,
      toolCalling: true,
      streaming: true
    },
    parameters: {
      maxContext: 512000,
      maxTokens: 65500,
      defaultTemperature: 0.7
    },
    pricing: {
      standard: {
        chat: { input: "$0.03 / 1M tokens", output: "$0.15 / 1M tokens" }
      },
      current: {
        chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" }
      }
    }
  }
  ```
  
  **图片模型配置示例**:
  ```typescript
  {
    id: "agnes-image-2.1-flash",
    name: "Agnes Image 2.1 Flash",
    type: "image",
    description: "高信息密度图片生成模型，支持图生图和关键帧模式",
    version: "2.1",
    provider: "Agnes AI",
    apiConfig: {
      endpoint: "https://apihub.agnes-ai.com/v1/images/generations",
      method: "POST"
    },
    capabilities: {
      img2img: true,
      keyframeMode: true
    },
    parameters: {
      supportedSizes: ["1024x768", "768x1024", "1024x1024", "1152x768"],
      defaultSteps: 25,
      responseFormats: ["url", "b64_json"]
    },
    pricing: {
      standard: { image: "$0.003 / 张" },
      current: { image: "$0 / 张" }
    }
  }
  ```
  
  **视频模型配置示例**:
  ```typescript
  {
    id: "agnes-video-v2.0",
    name: "Agnes Video V2.0",
    type: "video",
    description: "视频生成模型，支持文生视频、图生视频和关键帧模式",
    version: "2.0",
    provider: "Agnes AI",
    apiConfig: {
      endpoint: "https://apihub.agnes-ai.com/v1/videos",
      method: "POST",
      statusEndpoint: "https://apihub.agnes-ai.com/agnesapi?video_id={video_id}"
    },
    capabilities: {
      img2vid: true,
      keyframeMode: true,
      asyncGeneration: true
    },
    parameters: {
      supportedRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      maxDuration: 18,
      maxFrames: 441,
      frameRateRange: { min: 1, max: 60, default: 24 }
    },
    parameterRules: {
      num_frames: {
        min: 1,
        max: 441,
        rule: "8n+1",
        description: "帧数必须小于等于441，且遵循8n+1规则"
      }
    },
    pricing: {
      standard: { video: "$0.005 / 秒" },
      current: { video: "$0 / 秒" }
    }
  }
  ```

**异常流程**:
- 模型ID已存在 → 提示"模型ID已存在，请使用不同的ID"
- API Endpoint格式错误 → 提示"API Endpoint格式不正确，请检查URL"
- 必填字段缺失 → 提示"请填写所有必填字段"
- 参数配置不完整 → 提示"请完善模型参数配置"

**权限控制**: 仅管理员可注册模型  
**输入输出规则**:  
输入: 模型配置对象（ModelConfig）  
输出: 注册成功的模型对象  

**业务规则**:  
- 模型ID必须唯一
- API Endpoint必须为有效URL
- 必填字段：id、name、type、description、apiConfig
- 每种模型类型有特定的必填参数
- 注册后模型默认为"可用"状态
- 注册后自动生成模型能力标签

**优先级**: P0（阻塞）  
**验收标准**:
- AC1: Given 管理员填写完整配置, When 点击保存, Then 成功注册模型
- AC2: Given 注册聊天模型, When 配置完成, Then 包含所有聊天模型特定参数
- AC3: Given 注册图片模型, When 配置完成, Then 包含所有图片模型特定参数
- AC4: Given 注册视频模型, When 配置完成, Then 包含所有视频模型特定参数和约束规则
- AC5: Given 模型ID已存在, When 提交注册, Then 提示错误信息

**来源**: AI推导补充，依据：模型管理体系设计

---

#### Feature 1.2: 模型能力标签管理

**需求ID**: MODEL-CAP-001  
**需求名称**: 模型能力标签管理  
**功能描述**: 为每个模型配置能力标签，标识模型支持的特殊功能  
**触发条件**: 管理员在模型配置中编辑能力标签  
**前置条件**: 模型已注册  

**操作步骤**:
1. 管理员进入模型配置页面
2. 系统显示能力标签配置区域
3. 系统根据模型类型显示相关能力选项
4. 管理员勾选模型支持的能力
5. 系统保存能力标签配置

**正常流程**:
- 聊天模型能力标签：
  - ✅ 视觉理解支持（visionSupport）
  - ✅ Thinking模式支持（thinkingMode）
  - ✅ 工具调用支持（toolCalling）
  - ✅ 流式响应支持（streaming）
  
- 图片模型能力标签：
  - ✅ 图生图支持（img2img）
  - ✅ 关键帧模式支持（keyframeMode）
  - ✅ 高信息密度优化（highDensity）
  
- 视频模型能力标签：
  - ✅ 图生视频支持（img2vid）
  - ✅ 关键帧模式支持（keyframeMode）
  - ✅ 异步生成支持（asyncGeneration）
  - ✅ 帧数约束支持（frameConstraint）

**异常流程**:
- 不支持的能力标签 → 系统自动隐藏不适用的能力选项

**权限控制**: 仅管理员可编辑能力标签  
**输入输出规则**:  
输入: 能力标签配置对象  
输出: 更新后的模型配置  

**业务规则**:  
- 能力标签根据模型类型自动筛选
- 未勾选的能力默认为false
- 能力标签影响前端显示和参数验证

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 聊天模型, When 显示能力标签, Then 只显示聊天相关能力选项
- AC2: Given 图片模型, When 显示能力标签, Then 只显示图片相关能力选项
- AC3: Given 视频模型, When 显示能力标签, Then 只显示视频相关能力选项
- AC4: Given 管理员勾选能力, When 保存配置, Then 能力标签正确保存

**来源**: AI推导补充，依据：模型能力标签设计

---

#### Feature 1.3: 模型参数配置管理

**需求ID**: MODEL-PARAM-001  
**需求名称**: 模型参数配置管理  
**功能描述**: 为每个模型配置详细的参数设置，包括默认值、范围和约束规则  
**触发条件**: 管理员在模型配置中编辑参数  
**前置条件**: 模型已注册  

**操作步骤**:
1. 管理员进入模型配置页面
2. 系统显示参数配置区域
3. 系统根据模型类型显示相关参数字段
4. 管理员填写参数配置
5. 管理员配置参数约束规则
6. 系统验证参数合理性
7. 系统保存参数配置

**正常流程**:
- 聊天模型参数配置：
  - `maxContext`: 最大上下文长度（默认512000）
  - `maxTokens`: 最大输出token数（默认65500）
  - `defaultTemperature`: 默认温度（范围0-2，默认0.7）
  
- 图片模型参数配置：
  - `supportedSizes`: 支持的图片尺寸列表（如["1024x768", "1024x1024"]）
  - `defaultSteps`: 默认推理步数（默认25）
  - `responseFormats`: 支持的返回格式（["url", "b64_json"]）
  
- 视频模型参数配置：
  - `supportedRatios`: 支持的视频比例（["16:9", "9:16", "1:1"]）
  - `maxDuration`: 最大视频时长（默认18秒）
  - `maxFrames`: 最大帧数（默认441）
  - `frameRateRange`: 帧率范围（{min: 1, max: 60, default: 24}）
  
- 参数约束规则配置：
  - 视频模型帧数约束：`8n+1`规则
  - 其他参数约束：范围约束、必填约束

**异常流程**:
- 参数值超出范围 → 提示"参数值超出允许范围"
- 参数约束规则格式错误 → 提示"约束规则格式不正确"

**权限控制**: 仅管理员可编辑参数配置  
**输入输出规则**:  
输入: 参数配置对象  
输出: 更新后的模型配置  

**业务规则**:  
- 参数必须有合理的默认值
- 参数约束规则必须可执行
- 参数配置影响前端参数验证

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 聊天模型, When 配置参数, Then 包含maxContext、maxTokens、temperature
- AC2: Given 图片模型, When 配置参数, Then 包含supportedSizes、defaultSteps、responseFormats
- AC3: Given 视频模型, When 配置参数, Then 包含supportedRatios、maxDuration、frameRateRange
- AC4: Given 视频模型, When 配置约束规则, Then 正确保存8n+1规则
- AC5: Given 参数值超出范围, When 提交配置, Then 提示错误信息

**来源**: AI推导补充，依据：模型参数管理需求

---

#### Feature 1.4: 模型API配置管理

**需求ID**: MODEL-API-001  
**需求名称**: 模型API配置管理  
**功能描述**: 为每个模型配置API endpoint、请求方法和请求头信息  
**触发条件**: 管理员在模型配置中编辑API信息  
**前置条件**: 模型已注册  

**操作步骤**:
1. 管理员进入模型配置页面
2. 系统显示API配置区域
3. 管理员填写API Endpoint
4. 管理员选择HTTP方法（POST/GET）
5. 管理员配置自定义请求头
6. 管理员配置状态查询Endpoint（视频模型）
7. 系统验证API配置
8. 系统保存API配置

**正常流程**:
- API配置字段：
  - `endpoint`: API endpoint URL（必填）
  - `method`: HTTP方法（POST/GET，默认POST）
  - `headers`: 自定义请求头（可选）
  - `statusEndpoint`: 状态查询endpoint（视频模型异步生成）
  
- API配置示例：
  ```typescript
  {
    apiConfig: {
      endpoint: "https://apihub.agnes-ai.com/v1/videos",
      method: "POST",
      headers: {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
      },
      statusEndpoint: "https://apihub.agnes-ai.com/agnesapi?video_id={video_id}"
    }
  }
  ```

**异常流程**:
- API Endpoint格式错误 → 提示"Endpoint格式不正确，请检查URL"
- HTTP方法不支持 → 提示"只支持POST和GET方法"

**权限控制**: 仅管理员可编辑API配置  
**输入输出规则**:  
输入: API配置对象  
输出: 更新后的模型配置  

**业务规则**:  
- API Endpoint必须为有效URL
- HTTP方法只支持POST和GET
- 视频模型必须配置statusEndpoint
- headers中的API Key不直接存储，使用环境变量引用

**优先级**: P0（阻塞）  
**验收标准**:
- AC1: Given 管理员填写endpoint, When 提交配置, Then 成功保存API配置
- AC2: Given 视频模型, When 配置API, Then 包含statusEndpoint字段
- AC3: Given endpoint格式错误, When 提交配置, Then 提示错误信息

**来源**: AI推导补充，依据：API集成需求

---

### Epic 2: 模型选择策略

---

#### Feature 2.1: 智能模式（自动推荐）

**需求ID**: MODEL-SMART-001  
**需求名称**: 智能模式（自动推荐）  
**功能描述**: 系统根据任务类型、质量要求和成本限制自动推荐最佳模型  
**触发条件**: 用户创建AI任务时选择"智能模式"  
**前置条件**: 用户已登录，模型中心已配置默认模型  

**操作步骤**:
1. 用户创建AI任务（如生成剧本、生成角色、生成视频）
2. 用户选择"智能模式"
3. 系统识别任务类型
4. 系统分析任务需求：
   - 质量要求（快速/标准/高质量）
   - 成本限制（低成本/标准/无限制）
   - 时间要求（实时/标准/无限制）
5. 系统匹配最佳模型
6. 系统显示推荐模型
7. 用户确认使用推荐模型
8. 系统调用推荐模型执行任务

**正常流程**:
- 智能推荐逻辑：
  
  ```typescript
  function recommendModel(task: AITask): ModelConfig {
    // 1. 根据任务类型筛选模型
    const candidateModels = filterModelsByTaskType(task.type);
    
    // 2. 根据质量要求排序
    const sortedByQuality = sortModelsByQuality(candidateModels, task.qualityRequirement);
    
    // 3. 根据成本限制筛选
    const filteredByCost = filterModelsByCost(sortedByQuality, task.costLimit);
    
    // 4. 根据时间要求筛选
    const filteredByTime = filterModelsByTime(filteredByCost, task.timeRequirement);
    
    // 5. 返回最佳模型
    return filteredByTime[0];
  }
  ```
  
- 推荐策略示例：
  
  | 任务类型 | 质量要求 | 推荐模型 |
  |---------|---------|---------|
  | 剧本创作 | 标准 | Agnes 2.0 Flash |
  | 剧本创作 | 高质量 | Agnes 2.0 Pro |
  | 角色设计 | 标准 | Agnes Image 2.1 Flash |
  | 角色设计 | 高质量 | Agnes Image Pro |
  | 分镜视频 | 标准 | Agnes Video V2.0 |
  | 分镜视频 | 高质量 | Agnes Video V2.0 Pro |

**异常流程**:
- 无匹配模型 → 提示"当前没有合适的模型，请联系管理员"
- 推荐模型不可用 → 提示"推荐模型暂时不可用，请切换其他模型"

**权限控制**: 所有用户可用智能模式  
**输入输出规则**:  
输入: 任务对象（包含类型、质量要求、成本限制）  
输出: 推荐模型对象  

**业务规则**:  
- 智能模式优先选择默认模型
- 质量要求越高，选择性能更强的模型
- 成本限制越严格，选择成本更低的模型
- 时间要求越紧急，选择响应速度更快的模型

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 用户创建剧本任务, When 选择智能模式, Then 系统推荐聊天模型
- AC2: Given 用户创建角色任务, When 选择智能模式, Then 系统推荐图片模型
- AC3: Given 用户创建视频任务, When 选择智能模式, Then 系统推荐视频模型
- AC4: Given 任务质量要求高, When 推荐模型, Then 推荐高性能模型
- AC5: Given 无匹配模型, When 智能推荐, Then 提示错误信息

**来源**: AI推导补充，依据：智能模型选择策略设计

---

#### Feature 2.2: 专家模式（手动选择）

**需求ID**: MODEL-EXPERT-001  
**需求名称**: 专家模式（手动选择）  
**功能描述**: 专业用户可以手动选择模型，查看模型详细信息和参数配置  
**触发条件**: 用户创建AI任务时选择"专家模式"  
**前置条件**: 用户具有专业用户权限，模型中心已注册模型  

**操作步骤**:
1. 用户创建AI任务
2. 用户选择"专家模式"
3. 系统显示模型列表（按能力标签分组）
4. 用户查看模型详细信息：
   - 模型能力标签
   - 模型参数配置
   - 模型性能指标
   - 模型价格信息
5. 用户选择模型
6. 用户配置模型参数（可选）
7. 系统验证参数合理性
8. 系统调用选中模型执行任务

**正常流程**:
- 模型列表显示：
  
  ```
  选择生成模型
  
  【质量优先】
  Agnes Image Pro ★★★★★
  适合：电影感、角色设计
  价格：$0.003 / 张
  
  【速度优先】
  Agnes Image 2.1 Flash ★★★★
  适合：快速预览、批量生成
  价格：$0 / 张
  
  【风格控制】
  Custom ComfyUI ★★★★★
  适合：专业制作、风格定制
  价格：自定义
  ```
  
- 参数配置界面：
  
  ```
  模型参数配置
  
  图片尺寸：[1024x768] ▼
  推理步数：25
  返回格式：url ▼
  
  [高级设置]
  Seed: 
  CFG: 
  LoRA: 
  ```

**异常流程**:
- 参数值不合理 → 提示"参数值超出允许范围"
- 模型不可用 → 提示"该模型暂时不可用，请选择其他模型"

**权限控制**: 专业用户及以上可使用专家模式  
**输入输出规则**:  
输入: 用户选择的模型ID和参数配置  
输出: 任务执行结果  

**业务规则**:  
- 专家模式显示所有可用模型
- 参数配置需符合模型约束规则
- 专家模式可选择非默认模型

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 用户选择专家模式, When 查看模型列表, Then 显示所有可用模型
- AC2: Given 用户查看模型详情, When 点击模型, Then 显示能力标签和性能指标
- AC3: Given 用户配置参数, When 参数不合理, Then 提示错误信息
- AC4: Given 用户选择模型, When 确认执行, Then 使用选中模型执行任务

**来源**: AI推导补充，依据：专家模式设计

---

#### Feature 2.3: 管理员模式（策略配置）

**需求ID**: MODEL-ADMIN-001  
**需求名称**: 管理员模式（策略配置）  
**功能描述**: 管理员配置企业模型池、默认模型策略和用户权限  
**触发条件**: 管理员进入模型中心管理页面  
**前置条件**: 用户具有管理员权限  

**操作步骤**:
1. 管理员进入模型中心管理页面
2. 系统显示管理功能列表：
   - 模型池管理
   - 默认模型配置
   - 用户权限配置
   - 成本策略配置
3. 管理员选择配置项
4. 管理员修改配置
5. 系统保存配置

**正常流程**:
- 模型池管理：
  - 启用/禁用模型
  - 设置模型可用范围
  - 配置模型访问权限
  
- 默认模型配置：
  ```
  任务类型：剧本创作
  默认模型：Agnes 2.0 Flash
  
  任务类型：角色设计
  默认模型：Agnes Image 2.1 Flash
  
  任务类型：分镜视频
  默认模型：Agnes Video V2.0
  ```
  
- 用户权限配置：
  ```
  用户角色：编剧
  可用模型：Agnes 2.0 Flash
  配额限制：100次/天
  
  用户角色：美术
  可用模型：所有图片模型
  配额限制：无限制
  ```
  
- 成本策略配置：
  ```
  普通员工：
  每天成本限制：$10
  每月成本限制：$200
  
  设计师：
  每天成本限制：无限制
  每月成本限制：$1000
  ```

**异常流程**:
- 配置不合理 → 提示"配置不合理，请调整"
- 权限配置冲突 → 提示"权限配置存在冲突"

**权限控制**: 仅管理员可配置策略  
**输入输出规则**:  
输入: 管理员配置对象  
输出: 更新后的系统配置  

**业务规则**:  
- 管理员可配置默认模型
- 管理员可设置用户配额限制
- 管理员可控制成本预算
- 配置立即生效

**优先级**: P2（重要）  
**验收标准**:
- AC1: Given 管理员配置默认模型, When 保存配置, Then 系统更新默认模型
- AC2: Given 管理员设置用户配额, When 保存配置, Then 用户受配额限制
- AC3: Given 管理员配置成本策略, When 保存配置, Then 成本控制生效
- AC4: Given 配置不合理, When 提交配置, Then 提示错误信息

**来源**: AI推导补充，依据：企业管理员控制设计

---

#### Feature 2.4: 默认模型设置

**需求ID**: MODEL-DEFAULT-001  
**需求名称**: 默认模型设置  
**功能描述**: 用户可以设置自己常用的默认模型，下次创建任务时自动使用  
**触发条件**: 用户在模型中心点击"设为默认"按钮  
**前置条件**: 用户已登录，模型可用  

**操作步骤**:
1. 用户进入模型中心
2. 用户查看模型列表
3. 用户选择模型
4. 用户点击"设为默认"
5. 系统确认操作
6. 系统更新用户默认模型配置
7. 系统显示成功提示

**正常流程**:
- 默认模型配置：
  
  ```typescript
  {
    userId: "user-001",
    defaultModels: {
      chat: "agnes-2.0-flash",
      image: "agnes-image-2.1-flash",
      video: "agnes-video-v2.0"
    }
  }
  ```
  
- 用户创建任务时：
  
  ```
  创建剧本任务
  
  模型：
  ⭐ 默认模型 - Agnes 2.0 Flash
  
  [更换模型]
  ```

**异常流程**:
- 模型不可用 → 提示"该模型不可用，无法设为默认"

**权限控制**: 所有用户可设置自己的默认模型  
**输入输出规则**:  
输入: 模型ID  
输出: 更新后的用户配置  

**业务规则**:  
- 用户只能为每种类型设置一个默认模型
- 默认模型必须为可用状态
- 默认模型优先级高于系统默认模型

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 用户设置默认模型, When 点击设为默认, Then 成功设置
- AC2: Given 用户创建任务, When 未选择模型, Then 自动使用默认模型
- AC3: Given 用户设置不可用模型为默认, When 提交, Then 提示错误信息

**来源**: AI推导补充，依据：用户默认模型设置需求

---

### Epic 3: 模型调用与记录

---

#### Feature 3.1: 模型调用接口

**需求ID**: MODEL-CALL-001  
**需求名称**: 模型调用接口  
**功能描述**: 提供统一的模型调用接口，支持聊天、图片、视频三种类型  
**触发条件**: 业务模块调用模型中心接口  
**前置条件**: 模型已注册且可用，用户有调用权限  

**操作步骤**:
1. 业务模块构建调用请求
2. 业务模块调用模型中心接口
3. 模型中心验证请求参数
4. 模型中心选择目标模型
5. 模型中心构建API请求
6. 模型中心调用模型API
7. 模型中心接收API响应
8. 模型中心保存调用记录
9. 模型中心返回结果给业务模块

**正常流程**:
- 统一调用接口设计：
  
  ```typescript
  interface ModelCallRequest {
    modelId?: string;          // 指定模型ID（可选）
    taskType: "chat" | "image" | "video";
    taskName: string;          // 任务名称
    prompt: string;            // 提示词
    parameters: Record<string, any>;  // 参数配置
    userId: string;            // 用户ID
    projectId?: string;        // 项目ID（可选）
  }
  
  interface ModelCallResponse {
    taskId: string;            // 任务ID
    modelId: string;           // 使用的模型ID
    status: "success" | "failed" | "pending";
    result?: any;              // 生成结果
    error?: string;            // 错误信息
    usageStats: {
      inputTokens?: number;
      outputTokens?: number;
      cost?: number;
      duration: number;
    };
  }
  ```
  
- 调用示例：
  
  **聊天模型调用**:
  ```typescript
  const request = {
    taskType: "chat",
    taskName: "剧本创作",
    prompt: "请生成一个科幻题材的剧本大纲",
    parameters: {
      temperature: 0.7,
      max_tokens: 2000
    },
    userId: "user-001"
  };
  
  const response = await modelCenter.call(request);
  ```
  
  **图片模型调用**:
  ```typescript
  const request = {
    taskType: "image",
    taskName: "角色设计",
    prompt: "一个穿着古装的女性角色，长发飘飘，优雅端庄",
    parameters: {
      size: "1024x768",
      response_format: "url"
    },
    userId: "user-001"
  };
  
  const response = await modelCenter.call(request);
  ```
  
  **视频模型调用**:
  ```typescript
  const request = {
    taskType: "video",
    taskName: "分镜视频",
    prompt: "女性角色缓缓转身，优雅的背影",
    parameters: {
      image: "https://example.com/character.png",
      num_frames: 121,
      frame_rate: 24
    },
    userId: "user-001"
  };
  
  const response = await modelCenter.call(request);
  // 视频模型返回pending状态，需要后续查询
  ```

**异常流程**:
- 模型不可用 → 返回 `{status: "failed", error: "模型不可用"}`
- 参数不合理 → 返回 `{status: "failed", error: "参数不合理"}`
- API调用失败 → 返回 `{status: "failed", error: "API调用失败"}`
- 用户配额超限 → 返回 `{status: "failed", error: "用户配额超限"}`

**权限控制**: 根据用户角色和配额控制  
**输入输出规则**:  
输入: ModelCallRequest对象  
输出: ModelCallResponse对象  

**业务规则**:  
- 未指定modelId时使用默认模型
- 调用前验证参数合理性
- 调用后保存完整调用记录
- 视频模型返回pending状态，需异步查询

**优先级**: P0（阻塞）  
**验收标准**:
- AC1: Given 业务模块调用聊天模型, When 参数合理, Then 成功返回结果
- AC2: Given 业务模块调用图片模型, When 参数合理, Then 成功返回图片URL
- AC3: Given 业务模块调用视频模型, When 参数合理, Then 返回pending状态和taskId
- AC4: Given 参数不合理, When 调用模型, Then 返回错误信息
- AC5: Given 用户配额超限, When 调用模型, Then 拒绝调用并提示

**来源**: AI推导补充，依据：模型调用接口设计

---

#### Feature 3.2: 调用参数验证

**需求ID**: MODEL-VALID-001  
**需求名称**: 调用参数验证  
**功能描述**: 调用前验证参数合理性，确保符合模型约束规则  
**触发条件**: 模型中心收到调用请求  
**前置条件**: 模型已注册  

**操作步骤**:
1. 模型中心接收调用请求
2. 模型中心获取目标模型配置
3. 模型中心提取参数配置
4. 模型中心验证参数完整性
5. 模型中心验证参数合理性
6. 模型中心验证参数约束规则
7. 模型中心返回验证结果

**正常流程**:
- 参数验证逻辑：
  
  ```typescript
  function validateParameters(model: ModelConfig, params: Record<string, any>): ValidationResult {
    // 1. 验证必填参数
    for (const requiredParam of model.requiredParameters) {
      if (!params[requiredParam]) {
        return { valid: false, error: `缺少必填参数: ${requiredParam}` };
      }
    }
    
    // 2. 验证参数范围
    for (const [key, value] of Object.entries(params)) {
      const rule = model.parameterRules[key];
      if (rule) {
        if (rule.min && value < rule.min) {
          return { valid: false, error: `参数${key}小于最小值${rule.min}` };
        }
        if (rule.max && value > rule.max) {
          return { valid: false, error: `参数${key}大于最大值${rule.max}` };
        }
        if (rule.rule === "8n+1") {
          if (!isValid8nPlus1(value)) {
            return { valid: false, error: `参数${key}不符合8n+1规则` };
          }
        }
      }
    }
    
    // 3. 验证参数类型
    for (const [key, value] of Object.entries(params)) {
      const expectedType = model.parameterTypes[key];
      if (expectedType && typeof value !== expectedType) {
        return { valid: false, error: `参数${key}类型不正确` };
      }
    }
    
    return { valid: true };
  }
  
  function isValid8nPlus1(value: number): boolean {
    // 验证是否符合8n+1规则（如1, 9, 17, 25...）
    return (value - 1) % 8 === 0;
  }
  ```
  
- 验证示例：
  
  **聊天模型参数验证**:
  ```
  ✓ model: agnes-2.0-flash (必填)
  ✓ prompt: "生成剧本" (必填)
  ✓ temperature: 0.7 (范围0-2)
  ✓ max_tokens: 2000 (范围1-65500)
  ```
  
  **图片模型参数验证**:
  ```
  ✓ model: agnes-image-2.1-flash (必填)
  ✓ prompt: "角色设计" (必填)
  ✓ size: "1024x768" (支持尺寸列表)
  ✓ response_format: "url" (支持格式列表)
  ```
  
  **视频模型参数验证**:
  ```
  ✓ model: agnes-video-v2.0 (必填)
  ✓ prompt: "分镜视频" (必填)
  ✓ num_frames: 121 (≤441, 符合8n+1规则)
  ✓ frame_rate: 24 (范围1-60)
  ```

**异常流程**:
- 缺少必填参数 → 返回"缺少必填参数XXX"
- 参数超出范围 → 返回"参数XXX超出允许范围"
- 参数不符合约束规则 → 返回"参数XXX不符合约束规则"

**权限控制**: 系统自动执行  
**输入输出规则**:  
输入: 模型配置 + 参数对象  
输出: 验证结果对象  

**业务规则**:  
- 必填参数必须存在
- 参数值必须在允许范围内
- 特殊参数必须符合约束规则（如8n+1）
- 参数类型必须匹配

**优先级**: P0（阻塞）  
**验收标准**:
- AC1: Given 参数完整且合理, When 验证参数, Then 返回valid: true
- AC2: Given 缺少必填参数, When 验证参数, Then 返回错误信息
- AC3: Given 参数超出范围, When 验证参数, Then 返回错误信息
- AC4: Given 视频帧数不符合8n+1规则, When 验证参数, Then 返回错误信息

**来源**: AI推导补充，依据：参数验证需求

---

#### Feature 3.3: 调用记录保存

**需求ID**: MODEL-RECORD-001  
**需求名称**: 调用记录保存  
**功能描述**: 每次模型调用后保存完整记录，包括模型信息、参数、结果、成本等  
**触发条件**: 模型调用完成（成功或失败）  
**前置条件**: 模型调用已执行  

**操作步骤**:
1. 模型调用完成
2. 模型中心收集调用信息
3. 模型中心构建调用记录
4. 模型中心保存调用记录到数据库
5. 模型中心更新统计数据

**正常流程**:
- 调用记录结构：
  
  ```typescript
  interface ModelCallRecord {
    id: string;                // 记录ID
    taskId: string;            // 任务ID
    userId: string;            // 用户ID
    projectId?: string;        // 项目ID
    modelId: string;           // 模型ID
    modelName: string;         // 模型名称
    taskType: string;          // 任务类型
    taskName: string;          // 任务名称
    prompt: string;            // 提示词
    parameters: Record<string, any>;  // 参数配置
    result?: any;              // 生成结果
    status: "success" | "failed" | "pending";  // 调用状态
    error?: string;            // 错误信息
    usageStats: {
      inputTokens?: number;    // 输入token数
      outputTokens?: number;   // 输出token数
      cost?: number;           // 成本（美元）
      duration: number;        // 耗时（毫秒）
    };
    createdAt: string;         // 创建时间
    completedAt?: string;      // 完成时间
  }
  ```
  
- 记录保存示例：
  
  ```typescript
  const record = {
    id: "record-001",
    taskId: "task-001",
    userId: "user-001",
    modelId: "agnes-2.0-flash",
    modelName: "Agnes 2.0 Flash",
    taskType: "chat",
    taskName: "剧本创作",
    prompt: "请生成一个科幻题材的剧本大纲",
    parameters: { temperature: 0.7, max_tokens: 2000 },
    result: { content: "剧本大纲内容..." },
    status: "success",
    usageStats: {
      inputTokens: 150,
      outputTokens: 1800,
      cost: 0.00027,
      duration: 3200
    },
    createdAt: "2026-07-10T14:30:00Z",
    completedAt: "2026-07-10T14:30:03Z"
  };
  
  await db.modelCallRecords.insert(record);
  ```

**异常流程**:
- 记录保存失败 → 记录错误日志，不影响调用结果返回

**权限控制**: 系统自动执行  
**输入输出规则**:  
输入: 调用结果对象  
输出: 保存的记录对象  

**业务规则**:  
- 每次调用必须保存记录
- 记录包含完整的调用信息和结果
- 记录用于后续统计和分析
- 记录永久保存，不删除

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 模型调用成功, When 调用完成, Then 保存完整记录
- AC2: Given 模型调用失败, When 调用完成, Then 保存失败记录
- AC3: Given 调用记录保存, When 查询记录, Then 可查询到完整信息

**来源**: AI推导补充，依据：调用记录管理需求

---

#### Feature 3.4: 异步任务管理（视频模型）

**需求ID**: MODEL-ASYNC-001  
**需求名称**: 异步任务管理  
**功能描述**: 视频模型采用异步生成，需要轮询查询任务状态  
**触发条件**: 视频模型调用返回pending状态  
**前置条件**: 视频模型已调用，返回taskId和videoId  

**操作步骤**:
1. 视频模型调用返回pending状态
2. 模型中心保存任务ID和视频ID
3. 模型中心启动状态查询轮询
4. 模型中心定期查询任务状态
5. 任务完成后停止轮询
6. 模型中心更新任务状态和结果
7. 模型中心通知业务模块

**正常流程**:
- 异步任务状态查询：
  
  ```typescript
  interface AsyncTaskStatus {
    taskId: string;
    videoId: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    progress: number;          // 进度百分比
    resultUrl?: string;        // 视频URL（completed时）
    error?: string;            // 错误信息（failed时）
  }
  
  async function pollTaskStatus(taskId: string, videoId: string): Promise<AsyncTaskStatus> {
    const model = getModelConfig("agnes-video-v2.0");
    const statusEndpoint = model.apiConfig.statusEndpoint.replace("{video_id}", videoId);
    
    // 轮询查询状态（最多10分钟）
    const maxAttempts = 120;  // 120次 * 5秒 = 10分钟
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(statusEndpoint, {
        headers: { "Authorization": "Bearer YOUR_API_KEY" }
      });
      
      const status = await response.json();
      
      if (status.status === "completed") {
        return {
          taskId,
          videoId,
          status: "completed",
          progress: 100,
          resultUrl: status.url
        };
      }
      
      if (status.status === "failed") {
        return {
          taskId,
          videoId,
          status: "failed",
          progress: 0,
          error: status.error
        };
      }
      
      // 等待5秒后继续查询
      await sleep(5000);
    }
    
    return {
      taskId,
      videoId,
      status: "failed",
      progress: 0,
      error: "任务超时"
    };
  }
  ```
  
- 任务状态转换：
  
  ```
  queued（排队中）
    ↓
  in_progress（生成中）
    ↓
  completed（完成）或 failed（失败）
  ```

**异常流程**:
- 任务超时 → 标记为failed，提示"任务超时"
- API查询失败 → 继续查询，记录错误日志
- 视频生成失败 → 标记为failed，返回错误信息

**权限控制**: 系统自动执行  
**输入输出规则**:  
输入: taskId + videoId  
输出: AsyncTaskStatus对象  

**业务规则**:  
- 视频模型必须异步查询
- 查询间隔为5秒
- 最大查询时间为10分钟
- 完成后自动停止轮询

**优先级**: P0（阻塞）  
**验收标准**:
- AC1: Given 视频任务创建, When 返回pending, Then 启动状态轮询
- AC2: Given 任务状态completed, When 查询完成, Then 返回视频URL
- AC3: Given 任务状态failed, When 查询完成, Then 返回错误信息
- AC4: Given 任务超时, When 查询超时, Then 标记为failed

**来源**: AI推导补充，依据：视频模型异步生成需求

---

### Epic 4: 统计与分析

---

#### Feature 4.1: 调用统计

**需求ID**: MODEL-STAT-001  
**需求名称**: 调用统计  
**功能描述**: 统计模型调用次数、成功率、平均响应时间等指标  
**触发条件**: 用户查看模型统计页面  
**前置条件**: 已有调用记录  

**操作步骤**:
1. 用户进入模型中心统计页面
2. 系统查询调用记录
3. 系统计算各项统计指标
4. 系统显示统计结果

**正常流程**:
- 统计指标计算：
  
  ```typescript
  interface ModelStatistics {
    modelId: string;
    modelName: string;
    totalCalls: number;        // 总调用次数
    successCalls: number;      // 成功次数
    failedCalls: number;       // 失败次数
    successRate: number;       // 成功率（百分比）
    avgResponseTime: number;   // 平均响应时间（毫秒）
    avgInputTokens: number;    // 平均输入token数
    avgOutputTokens: number;   // 平均输出token数
    todayCalls: number;        // 今日调用次数
    weekCalls: number;         // 本周调用次数
    monthCalls: number;        // 本月调用次数
    lastUsedAt: string;        // 最后使用时间
  }
  ```
  
- 统计示例：
  
  ```
  Agnes 2.0 Flash 统计
  
  总调用次数：1,234次
  成功次数：1,230次
  失败次数：4次
  成功率：99.7%
  
  平均响应时间：500ms
  平均输入token：200
  平均输出token：1,500
  
  今日调用：45次
  本周调用：320次
  本月调用：1,234次
  
  最后使用：2026-07-10 14:30
  ```

**异常流程**:
- 无调用记录 → 显示"暂无统计数据"

**权限控制**: 所有用户可查看统计  
**输入输出规则**:  
输入: 模型ID（可选）  
输出: 统计结果对象  

**业务规则**:  
- 统计数据实时计算
- 按模型类型分组统计
- 支持按时间范围筛选

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 查看模型统计, When 有调用记录, Then 显示完整统计数据
- AC2: Given 无调用记录, When 查看统计, Then 显示"暂无数据"
- AC3: Given 查看今日统计, When 筛选时间范围, Then 显示今日数据

**来源**: AI推导补充，依据：调用统计需求

---

#### Feature 4.2: 成本统计

**需求ID**: MODEL-COST-001  
**需求名称**: 成本统计  
**功能描述**: 统计模型调用成本，支持按用户、项目、时间范围筛选  
**触发条件**: 管理员查看成本统计页面  
**前置条件**: 已有调用记录且包含成本信息  

**操作步骤**:
1. 管理员进入成本统计页面
2. 系统查询调用记录
3. 系统计算成本数据
4. 系统按筛选条件分组统计
5. 系统显示成本统计结果

**正常流程**:
- 成本统计指标：
  
  ```typescript
  interface CostStatistics {
    totalCost: number;         // 总成本（美元）
    avgCostPerCall: number;    // 平均每次调用成本
    avgCostPerDay: number;     // 平均每日成本
    avgCostPerMonth: number;   // 平均每月成本
    costByUser: Array<{        // 按用户统计
      userId: string;
      userName: string;
      totalCost: number;
      callCount: number;
    }>;
    costByProject: Array<{     // 按项目统计
      projectId: string;
      projectName: string;
      totalCost: number;
      callCount: number;
    }>;
    costByModel: Array<{       // 按模型统计
      modelId: string;
      modelName: string;
      totalCost: number;
      callCount: number;
    }>;
    costByTime: Array<{        // 按时间统计
      date: string;
      totalCost: number;
      callCount: number;
    }>;
  }
  ```
  
- 成本统计示例：
  
  ```
  成本统计概览
  
  总成本：$23.45
  平均每次调用：$0.019
  平均每日成本：$1.56
  平均每月成本：$46.80
  
  ────────────────────
  
  按用户统计：
  张三：$12.34 (678次)
  李四：$8.90 (456次)
  王五：$2.21 (100次)
  
  ────────────────────
  
  按模型统计：
  Agnes 2.0 Flash：$5.67 (聊天)
  Agnes Image 2.1：$10.23 (图片)
  Agnes Video V2.0：$7.55 (视频)
  ```

**异常流程**:
- 无成本记录 → 显示"暂无成本数据"

**权限控制**: 管理员可查看所有成本，用户只能查看自己的成本  
**输入输出规则**:  
输入: 筛选条件（用户/项目/时间范围）  
输出: 成本统计结果  

**业务规则**:  
- 成本按模型价格计算
- 支持多维度分组统计
- 成本数据实时计算

**优先级**: P2（重要）  
**验收标准**:
- AC1: Given 管理员查看成本, When 有成本记录, Then 显示完整成本统计
- AC2: Given 按用户筛选, When 查看成本, Then 显示各用户成本
- AC3: Given 按模型筛选, When 查看成本, Then 显示各模型成本
- AC4: Given 按时间筛选, When 查看成本, Then 显示指定时间范围成本

**来源**: AI推导补充，依据：成本管理需求

---

#### Feature 4.3: 性能分析

**需求ID**: MODEL-PERF-001  
**需求名称**: 性能分析  
**功能描述**: 分析模型性能指标，包括响应时间、成功率、吞吐量等  
**触发条件**: 管理员查看性能分析页面  
**前置条件**: 已有调用记录  

**操作步骤**:
1. 管理员进入性能分析页面
2. 系统查询调用记录
3. 系统计算性能指标
4. 系统生成性能图表
5. 系统显示性能分析结果

**正常流程**:
- 性能指标计算：
  
  ```typescript
  interface PerformanceMetrics {
    modelId: string;
    avgResponseTime: number;   // 平均响应时间
    p50ResponseTime: number;   // P50响应时间
    p90ResponseTime: number;   // P90响应时间
    p95ResponseTime: number;   // P95响应时间
    successRate: number;       // 成功率
    throughput: number;        // 吞吐量（每分钟调用数）
    concurrency: number;       // 并发数
    errorRate: number;         // 错误率
    timeoutRate: number;       // 超时率
    performanceTrend: Array<{  // 性能趋势
      time: string;
      avgResponseTime: number;
      successRate: number;
    }>;
  }
  ```
  
- 性能分析示例：
  
  ```
  Agnes 2.0 Flash 性能分析
  
  平均响应时间：500ms
  P50响应时间：450ms
  P90响应时间：650ms
  P95响应时间：800ms
  
  成功率：99.7%
  错误率：0.3%
  超时率：0.1%
  
  吞吐量：100次/分钟
  并发数：50
  
  ────────────────────
  
  性能趋势图：
  [响应时间折线图]
  [成功率折线图]
  ```

**异常流程**:
- 无性能数据 → 显示"暂无性能数据"

**权限控制**: 管理员可查看性能分析  
**输入输出规则**:  
输入: 模型ID + 时间范围  
输出: 性能指标对象  

**业务规则**:  
- 性能数据实时计算
- 支持性能趋势图表
- 性能异常自动告警

**优先级**: P2（重要）  
**验收标准**:
- AC1: Given 管理员查看性能, When 有调用记录, Then 显示性能指标
- AC2: Given 查看性能趋势, When 选择时间范围, Then 显示趋势图表
- AC3: Given 性能异常, When 成功率下降, Then 自动告警

**来源**: AI推导补充，依据：性能分析需求

---

#### Feature 4.4: 模型评分系统

**需求ID**: MODEL-SCORE-001  
**需求名称**: 模型评分系统  
**功能描述**: 用户可以对模型生成结果评分，形成模型质量评价  
**触发条件**: 用户查看模型生成结果后点击评分  
**前置条件**: 模型调用已完成，有生成结果  

**操作步骤**:
1. 用户查看生成结果
2. 用户点击评分按钮
3. 系统显示评分界面
4. 用户选择评分等级（1-5星）
5. 用户填写评分原因（可选）
6. 系统保存评分记录
7. 系统更新模型平均评分

**正常流程**:
- 评分记录结构：
  
  ```typescript
  interface ModelScore {
    id: string;
    taskId: string;            // 任务ID
    userId: string;            // 用户ID
    modelId: string;           // 模型ID
    score: number;             // 评分（1-5）
    reason?: string;           // 评分原因
    createdAt: string;         // 评分时间
  }
  
  interface ModelScoreSummary {
    modelId: string;
    avgScore: number;          // 平均评分
    totalScores: number;       // 总评分次数
    scoreDistribution: {       // 评分分布
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    topReasons: Array<string>; // 常见评分原因
  }
  ```
  
- 评分界面：
  
  ```
  对本次生成结果评分
  
  ⭐⭐⭐⭐⭐ (5星)
  
  评分原因（可选）：
  [文本框]
  
  [提交评分]
  ```

**异常流程**:
- 重复评分 → 提示"您已对该结果评分，请勿重复评分"

**权限控制**: 所有用户可评分  
**输入输出规则**:  
输入: 评分对象（score + reason）  
输出: 更新后的评分汇总  

**业务规则**:  
- 评分范围1-5星
- 每个用户对同一结果只能评分一次
- 评分影响模型推荐权重
- 高评分模型优先推荐

**优先级**: P2（重要）  
**验收标准**:
- AC1: Given 用户评分, When 提交评分, Then 成功保存评分
- AC2: Given 模型有评分记录, When 查看评分汇总, Then 显示平均评分
- AC3: Given 重复评分, When 提交评分, Then 提示错误信息
- AC4: Given 模型评分高, When 推荐模型, Then 优先推荐高评分模型

**来源**: AI推导补充，依据：模型评分系统需求

---

### Epic 5: 权限与控制

---

#### Feature 5.1: 模型访问权限

**需求ID**: MODEL-PERM-001  
**需求名称**: 模型访问权限  
**功能描述**: 控制不同用户角色对模型的访问权限  
**触发条件**: 用户尝试调用模型  
**前置条件**: 用户已登录，模型已注册  

**操作步骤**:
1. 用户尝试调用模型
2. 系统检查用户权限
3. 系统验证模型访问权限
4. 权限验证通过 → 允许调用
5. 权限验证失败 → 拒绝调用

**正常流程**:
- 权限配置结构：
  
  ```typescript
  interface ModelPermission {
    modelId: string;
    allowedRoles: Array<string>;  // 允许的角色列表
    allowedUsers?: Array<string>; // 允许的用户列表
    deniedUsers?: Array<string>;  // 禁止的用户列表
  }
  ```
  
- 权限验证逻辑：
  
  ```typescript
  function checkModelPermission(userId: string, userRole: string, modelId: string): boolean {
    const permission = getModelPermission(modelId);
    
    // 1. 检查角色权限
    if (!permission.allowedRoles.includes(userRole)) {
      return false;
    }
    
    // 2. 检查用户权限（白名单）
    if (permission.allowedUsers && !permission.allowedUsers.includes(userId)) {
      return false;
    }
    
    // 3. 检查用户权限（黑名单）
    if (permission.deniedUsers && permission.deniedUsers.includes(userId)) {
      return false;
    }
    
    return true;
  }
  ```
  
- 权限配置示例：
  
  ```
  Agnes 2.0 Pro 权限配置
  
  允许角色：管理员、专业用户
  允许用户：所有专业用户
  禁止用户：无
  
  ────────────────────
  
  Custom ComfyUI 权限配置
  
  允许角色：管理员
  允许用户：user-001, user-002
  禁止用户：无
  ```

**异常流程**:
- 权限不足 → 提示"您没有权限使用该模型"

**权限控制**: 管理员可配置权限  
**输入输出规则**:  
输入: 用户ID + 模型ID  
输出: 权限验证结果  

**业务规则**:  
- 默认所有用户可访问默认模型
- 专业模型需专业用户权限
- 自定义模型需管理员授权
- 权限配置立即生效

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 用户角色匹配, When 验证权限, Then 允许访问
- AC2: Given 用户角色不匹配, When 验证权限, Then 拒绝访问
- AC3: Given 用户在黑名单, When 验证权限, Then 拒绝访问
- AC4: Given 管理员配置权限, When 保存配置, Then 权限立即生效

**来源**: AI推导补充，依据：模型访问权限需求

---

#### Feature 5.2: 用户配额限制

**需求ID**: MODEL-QUOTA-001  
**需求名称**: 用户配额限制  
**功能描述**: 控制用户的模型调用次数配额  
**触发条件**: 用户尝试调用模型  
**前置条件**: 用户已登录，已配置配额  

**操作步骤**:
1. 用户尝试调用模型
2. 系统检查用户配额
3. 系统计算已使用配额
4. 配额充足 → 允许调用
5. 配额不足 → 拒绝调用

**正常流程**:
- 配额配置结构：
  
  ```typescript
  interface UserQuota {
    userId: string;
    dailyQuota: number;       // 每日配额
    weeklyQuota: number;      // 每周配额
    monthlyQuota: number;     // 每月配额
    dailyUsed: number;        // 今日已用
    weeklyUsed: number;       // 本周已用
    monthlyUsed: number;      // 本月已用
    quotaResetTime: string;   // 配额重置时间
  }
  ```
  
- 配额验证逻辑：
  
  ```typescript
  function checkUserQuota(userId: string): boolean {
    const quota = getUserQuota(userId);
    
    // 1. 检查每日配额
    if (quota.dailyQuota && quota.dailyUsed >= quota.dailyQuota) {
      return false;
    }
    
    // 2. 检查每周配额
    if (quota.weeklyQuota && quota.weeklyUsed >= quota.weeklyQuota) {
      return false;
    }
    
    // 3. 检查每月配额
    if (quota.monthlyQuota && quota.monthlyUsed >= quota.monthlyQuota) {
      return false;
    }
    
    return true;
  }
  ```
  
- 配额配置示例：
  
  ```
  普通员工配额
  
  每日配额：100次
  每周配额：500次
  每月配额：2000次
  
  ────────────────────
  
  设计师配额
  
  每日配额：无限制
  每周配额：无限制
  每月配额：10000次
  ```

**异常流程**:
- 配额不足 → 提示"您的配额已用完，请等待配额重置或联系管理员"
- 配额重置失败 → 系统自动重置配额

**权限控制**: 管理员可配置配额  
**输入输出规则**:  
输入: 用户ID  
输出: 配额验证结果  

**业务规则**:  
- 配额每日0点重置
- 配额不足时拒绝调用
- 管理员可手动重置配额
- 配额配置立即生效

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 配额充足, When 验证配额, Then 允许调用
- AC2: Given 配额不足, When 验证配额, Then 拒绝调用
- AC3: Given 配额重置时间到达, When 自动重置, Then 配额清零
- AC4: Given 管理员配置配额, When 保存配置, Then 配额立即生效

**来源**: AI推导补充，依据：用户配额限制需求

---

#### Feature 5.3: 成本预算控制

**需求ID**: MODEL-BUDGET-001  
**需求名称**: 成本预算控制  
**功能描述**: 控制用户的成本预算，超出预算时拒绝调用  
**触发条件**: 用户尝试调用模型  
**前置条件**: 用户已登录，已配置成本预算  

**操作步骤**:
1. 用户尝试调用模型
2. 系统检查用户成本预算
3. 系统计算已使用成本
4. 系统估算本次调用成本
5. 预算充足 → 允许调用
6. 预算不足 → 拒绝调用

**正常流程**:
- 成本预算配置：
  
  ```typescript
  interface UserBudget {
    userId: string;
    dailyBudget: number;      // 每日预算（美元）
    weeklyBudget: number;     // 每周预算
    monthlyBudget: number;    // 每月预算
    dailyUsed: number;        // 今日已用
    weeklyUsed: number;       // 本周已用
    monthlyUsed: number;      // 本月已用
    budgetResetTime: string;  // 预算重置时间
  }
  ```
  
- 成本估算逻辑：
  
  ```typescript
  function estimateCost(model: ModelConfig, params: Record<string, any>): number {
    if (model.type === "chat") {
      // 聊天模型成本估算
      const inputTokens = estimateInputTokens(params.prompt);
      const outputTokens = params.max_tokens || 2000;
      const inputCost = parseFloat(model.pricing.current.chat.input.replace("$", "").split(" ")[0]);
      const outputCost = parseFloat(model.pricing.current.chat.output.replace("$", "").split(" ")[0]);
      return (inputTokens / 1000000 * inputCost) + (outputTokens / 1000000 * outputCost);
    }
    
    if (model.type === "image") {
      // 图片模型成本估算（固定成本）
      return parseFloat(model.pricing.current.image.replace("$", "").split(" ")[0]);
    }
    
    if (model.type === "video") {
      // 视频模型成本估算（按时长）
      const duration = (params.num_frames || 121) / (params.frame_rate || 24);
      const costPerSecond = parseFloat(model.pricing.current.video.replace("$", "").split(" ")[0]);
      return duration * costPerSecond;
    }
    
    return 0;
  }
  ```
  
- 成本预算配置示例：
  
  ```
  普通员工成本预算
  
  每日预算：$10
  每周预算：$50
  每月预算：$200
  
  ────────────────────
  
  设计师成本预算
  
  每日预算：$100
  每周预算：$500
  每月预算：$1000
  ```

**异常流程**:
- 预算不足 → 提示"您的成本预算已用完，请等待预算重置或联系管理员"
- 成本估算失败 → 使用历史平均成本估算

**权限控制**: 管理员可配置预算  
**输入输出规则**:  
输入: 用户ID + 模型ID + 参数  
输出: 预算验证结果  

**业务规则**:  
- 预算每日0点重置
- 调用前估算成本
- 预算不足时拒绝调用
- 管理员可手动重置预算

**优先级**: P2（重要）  
**验收标准**:
- AC1: Given 预算充足, When 验证预算, Then 允许调用
- AC2: Given 预算不足, When 验证预算, Then 拒绝调用
- AC3: Given 预算重置时间到达, When 自动重置, Then 预算清零
- AC4: Given 成本估算, When 调用聊天模型, Then 估算token成本
- AC5: Given 成本估算, When 调用视频模型, Then 估算时长成本

**来源**: AI推导补充，依据：成本预算控制需求

---

#### Feature 5.4: 企业模型池管理

**需求ID**: MODEL-POOL-001  
**需求名称**: 企业模型池管理  
**功能描述**: 管理员管理企业可用的模型池，启用/禁用模型  
**触发条件**: 管理员进入模型池管理页面  
**前置条件**: 用户具有管理员权限  

**操作步骤**:
1. 管理员进入模型池管理页面
2. 系统显示所有已注册模型
3. 管理员选择模型
4. 管理员设置模型状态（启用/禁用）
5. 系统保存模型池配置

**正常流程**:
- 模型池管理界面：
  
  ```
  企业模型池管理
  
  ────────────────────
  
  聊天模型
  
  Agnes 2.0 Flash    [启用] ✓
  Agnes 2.0 Pro      [启用] ✓
  Agnes 2.0 Thinking [禁用] ✗
  
  ────────────────────
  
  图片模型
  
  Agnes Image 2.1 Flash [启用] ✓
  Agnes Image Pro       [启用] ✓
  Custom ComfyUI        [禁用] ✗
  
  ────────────────────
  
  视频模型
  
  Agnes Video V2.0     [启用] ✓
  Agnes Video V2.0 Pro [禁用] ✗
  ```
  
- 模型池配置结构：
  
  ```typescript
  interface ModelPoolConfig {
    modelId: string;
    isEnabled: boolean;       // 是否启用
    availableSince: string;   // 启用时间
    availableUntil?: string;  // 禁用时间（可选）
    notes?: string;           // 备注
  }
  ```

**异常流程**:
- 禁用默认模型 → 提示"禁用默认模型会影响所有用户，请先设置新的默认模型"

**权限控制**: 仅管理员可管理模型池  
**输入输出规则**:  
输入: 模型ID + 启用状态  
输出: 更新后的模型池配置  

**业务规则**:  
- 禁用模型立即生效
- 禁用模型不可被调用
- 禁用默认模型需先设置新默认模型
- 启用模型需验证API可用性

**优先级**: P1（必须）  
**验收标准**:
- AC1: Given 管理员启用模型, When 保存配置, Then 模型变为可用
- AC2: Given 管理员禁用模型, When 保存配置, Then 模型变为不可用
- AC3: Given 禁用默认模型, When 提交配置, Then 提示先设置新默认模型
- AC4: Given 模型被禁用, When 用户调用, Then 拒绝调用

**来源**: AI推导补充，依据：企业模型池管理需求

---

## 四、数据模型设计

### 4.1 核心表结构

#### 模型配置表（model_configs）

```sql
CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,                    -- 模型ID
  name TEXT NOT NULL,                     -- 模型名称
  type TEXT NOT NULL,                     -- 模型类型：chat/image/video
  description TEXT,                       -- 模型描述
  version TEXT,                           -- 模型版本
  provider TEXT,                          -- 提供商
  is_default BOOLEAN DEFAULT 0,           -- 是否为默认模型
  is_enabled BOOLEAN DEFAULT 1,           -- 是否启用
  
  -- API配置
  api_endpoint TEXT NOT NULL,             -- API endpoint
  api_method TEXT DEFAULT 'POST',         -- HTTP方法
  api_headers TEXT,                       -- 自定义请求头（JSON）
  status_endpoint TEXT,                   -- 状态查询endpoint
  
  -- 能力标签
  capabilities TEXT,                      -- 能力标签（JSON）
  
  -- 参数配置
  parameters TEXT,                        -- 参数配置（JSON）
  parameter_rules TEXT,                   -- 参数约束规则（JSON）
  
  -- 价格信息
  pricing TEXT,                           -- 价格信息（JSON）
  
  -- 性能指标
  avg_response_time INTEGER DEFAULT 0,    -- 平均响应时间
  success_rate REAL DEFAULT 0,            -- 成功率
  concurrency INTEGER DEFAULT 0,          -- 并发数
  
  -- 统计信息
  total_calls INTEGER DEFAULT 0,          -- 总调用次数
  today_calls INTEGER DEFAULT 0,          -- 今日调用次数
  week_calls INTEGER DEFAULT 0,           -- 本周调用次数
  month_calls INTEGER DEFAULT 0,          -- 本月调用次数
  last_used_at TEXT,                      -- 最后使用时间
  
  created_at TEXT NOT NULL,               -- 创建时间
  updated_at TEXT NOT NULL,               -- 更新时间
  tags TEXT                               -- 标签（JSON）
);
```

---

#### 模型调用记录表（model_call_records）

```sql
CREATE TABLE model_call_records (
  id TEXT PRIMARY KEY,                    -- 记录ID
  task_id TEXT NOT NULL,                  -- 任务ID
  user_id TEXT NOT NULL,                  -- 用户ID
  project_id TEXT,                        -- 项目ID
  model_id TEXT NOT NULL,                 -- 模型ID
  model_name TEXT NOT NULL,               -- 模型名称
  task_type TEXT NOT NULL,                -- 任务类型
  task_name TEXT NOT NULL,                -- 任务名称
  prompt TEXT NOT NULL,                   -- 提示词
  parameters TEXT,                        -- 参数配置（JSON）
  result TEXT,                            -- 生成结果（JSON）
  status TEXT NOT NULL,                   -- 调用状态：success/failed/pending
  error TEXT,                             -- 错误信息
  
  -- 使用统计
  input_tokens INTEGER,                   -- 输入token数
  output_tokens INTEGER,                  -- 输出token数
  cost REAL,                              -- 成本（美元）
  duration INTEGER,                       -- 耗时（毫秒）
  
  created_at TEXT NOT NULL,               -- 创建时间
  completed_at TEXT                       -- 完成时间
);
```

---

#### 模型评分表（model_scores）

```sql
CREATE TABLE model_scores (
  id TEXT PRIMARY KEY,                    -- 评分ID
  task_id TEXT NOT NULL,                  -- 任务ID
  user_id TEXT NOT NULL,                  -- 用户ID
  model_id TEXT NOT NULL,                 -- 模型ID
  score INTEGER NOT NULL,                 -- 评分（1-5）
  reason TEXT,                            -- 评分原因
  created_at TEXT NOT NULL                -- 评分时间
);
```

---

#### 用户配额表（user_quotas）

```sql
CREATE TABLE user_quotas (
  id TEXT PRIMARY KEY,                    -- 配额ID
  user_id TEXT NOT NULL UNIQUE,           -- 用户ID
  daily_quota INTEGER,                    -- 每日配额
  weekly_quota INTEGER,                   -- 每周配额
  monthly_quota INTEGER,                  -- 每月配额
  daily_used INTEGER DEFAULT 0,           -- 今日已用
  weekly_used INTEGER DEFAULT 0,          -- 本周已用
  monthly_used INTEGER DEFAULT 0,         -- 本月已用
  quota_reset_time TEXT,                  -- 配额重置时间
  created_at TEXT NOT NULL,               -- 创建时间
  updated_at TEXT NOT NULL                -- 更新时间
);
```

---

#### 用户成本预算表（user_budgets）

```sql
CREATE TABLE user_budgets (
  id TEXT PRIMARY KEY,                    -- 预算ID
  user_id TEXT NOT NULL UNIQUE,           -- 用户ID
  daily_budget REAL,                      -- 每日预算（美元）
  weekly_budget REAL,                     -- 每周预算
  monthly_budget REAL,                    -- 每月预算
  daily_used REAL DEFAULT 0,              -- 今日已用
  weekly_used REAL DEFAULT 0,             -- 本周已用
  monthly_used REAL DEFAULT 0,            -- 本月已用
  budget_reset_time TEXT,                 -- 预算重置时间
  created_at TEXT NOT NULL,               -- 创建时间
  updated_at TEXT NOT NULL                -- 更新时间
);
```

---

#### 模型权限表（model_permissions）

```sql
CREATE TABLE model_permissions (
  id TEXT PRIMARY KEY,                    -- 权限ID
  model_id TEXT NOT NULL,                 -- 模型ID
  allowed_roles TEXT,                     -- 允许的角色（JSON数组）
  allowed_users TEXT,                     -- 允许的用户（JSON数组）
  denied_users TEXT,                      -- 禁止的用户（JSON数组）
  created_at TEXT NOT NULL,               -- 创建时间
  updated_at TEXT NOT NULL                -- 更新时间
);
```

---

### 4.2 索引设计

```sql
-- 模型配置表索引
CREATE INDEX idx_model_configs_type ON model_configs(type);
CREATE INDEX idx_model_configs_default ON model_configs(is_default);
CREATE INDEX idx_model_configs_enabled ON model_configs(is_enabled);

-- 模型调用记录表索引
CREATE INDEX idx_model_call_records_user ON model_call_records(user_id);
CREATE INDEX idx_model_call_records_model ON model_call_records(model_id);
CREATE INDEX idx_model_call_records_project ON model_call_records(project_id);
CREATE INDEX idx_model_call_records_time ON model_call_records(created_at);
CREATE INDEX idx_model_call_records_status ON model_call_records(status);

-- 模型评分表索引
CREATE INDEX idx_model_scores_model ON model_scores(model_id);
CREATE INDEX idx_model_scores_user ON model_scores(user_id);
CREATE INDEX idx_model_scores_task ON model_scores(task_id);
```

---

## 五、API集成设计

### 5.1 Agnes 2.0 Flash（聊天模型）

#### API Endpoint
```
POST https://apihub.agnes-ai.com/v1/chat/completions
```

#### 请求头
```typescript
headers: {
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

#### 请求参数
```typescript
{
  model: "agnes-2.0-flash",
  messages: [
    { role: "system", content: "You are a helpful AI assistant." },
    { role: "user", content: "Prompt text" }
  ],
  temperature?: number,       // 默认0.7
  max_tokens?: number,        // 默认2000
  stream?: boolean,           // 默认false
  tools?: array,              // 工具调用定义
  chat_template_kwargs?: {    // Thinking模式（OpenAI格式）
    enable_thinking: boolean
  },
  thinking?: {                // Thinking模式（Anthropic格式）
    type: "enabled",
    budget_tokens: number
  }
}
```

#### 响应格式
```typescript
{
  id: "chatcmpl_xxx",
  object: "chat.completion",
  created: 1774432125,
  model: "agnes-2.0-flash",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Generated content"
      },
      finish_reason: "stop"
    }
  ],
  usage: {
    prompt_tokens: 150,
    completion_tokens: 1800,
    total_tokens: 1950
  }
}
```

#### 特殊功能
- **视觉理解**: 支持 `messages[].content` 为数组，包含 `text` 和 `image_url` 类型
- **Thinking模式**: 支持 `chat_template_kwargs.enable_thinking` 或 `thinking.type: "enabled"`
- **工具调用**: 支持 `tools` 参数定义工具
- **流式响应**: 支持 `stream: true`

---

### 5.2 Agnes Image 2.1 Flash（图片生成模型）

#### API Endpoint
```
POST https://apihub.agnes-ai.com/v1/images/generations
```

#### 请求头
```typescript
headers: {
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

#### 请求参数
```typescript
{
  model: "agnes-image-2.1-flash",
  prompt: string,             // 必填
  size: string,               // 必填，如"1024x768"
  extra_body: {
    response_format: "url" | "b64_json",  // 返回格式
    image?: string[]          // 图生图：输入图片URL数组
  }
}
```

#### 响应格式
```typescript
{
  created: 1780000000,
  data: [
    {
      url: "https://storage.googleapis.com/agnes-aigc/xxx.png",
      b64_json: null,
      revised_prompt: null
    }
  ]
}
```

#### 特殊功能
- **图生图**: 使用 `extra_body.image` 提供输入图片URL
- **关键帧模式**: 使用 `extra_body.image` 数组提供多张图片
- **返回格式**: 支持URL或Base64返回

---

### 5.3 Agnes Video V2.0（视频生成模型）

#### API Endpoint
```
POST https://apihub.agnes-ai.com/v1/videos
```

#### 状态查询Endpoint
```
GET https://apihub.agnes-ai.com/agnesapi?video_id={video_id}
```

#### 请求头
```typescript
headers: {
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

#### 请求参数
```typescript
{
  model: "agnes-video-v2.0",
  prompt: string,             // 必填
  image?: string,             // 图生视频：输入图片URL
  height?: integer,           // 默认768
  width?: integer,            // 默认1152
  num_frames?: integer,       // ≤441，遵循8n+1规则
  frame_rate?: number,        // 范围1-60，默认24
  num_inference_steps?: integer,
  seed?: integer,
  negative_prompt?: string,
  extra_body: {
    image?: string[],         // 关键帧模式：多张图片URL
    mode?: "keyframes"        // 关键帧模式
  }
}
```

#### 创建响应格式
```typescript
{
  id: "task_xxx",
  task_id: "task_xxx",
  video_id: "video_xxx",
  object: "video",
  model: "agnes-video-v2.0",
  status: "queued",
  progress: 0,
  created_at: 1780457477,
  seconds: "10.0",
  size: "1280x768"
}
```

#### 状态查询响应格式
```typescript
{
  id: "task_xxx",
  video_id: "video_xxx",
  model: "agnes-video-v2.0",
  object: "video",
  status: "completed",
  progress: 100,
  seconds: "10.0",
  size: "1280x768",
  url: "https://platform-outputs.agnes-ai.space/videos/xxx.mp4",
  error: null
}
```

#### 特殊功能
- **异步生成**: 返回pending状态，需轮询查询
- **图生视频**: 使用 `image` 参数提供输入图片URL
- **关键帧模式**: 使用 `extra_body.image` 数组 + `extra_body.mode: "keyframes"`
- **帧数约束**: `num_frames` 必须 ≤441 且遵循 `8n+1` 规则

---

### 5.4 统一调用接口设计

```typescript
// 模型中心统一调用接口
interface ModelCenterAPI {
  // 调用模型
  call(request: ModelCallRequest): Promise<ModelCallResponse>;
  
  // 查询异步任务状态（视频模型）
  queryTaskStatus(taskId: string, videoId: string): Promise<AsyncTaskStatus>;
  
  // 获取可用模型列表
  listModels(type?: ModelType): Promise<ModelConfig[]>;
  
  // 设置默认模型
  setDefaultModel(modelId: string): Promise<ModelConfig>;
  
  // 获取模型详情
  getModelDetail(modelId: string): Promise<ModelConfig>;
  
  // 获取调用统计
  getStatistics(modelId?: string, timeRange?: TimeRange): Promise<ModelStatistics>;
  
  // 获取成本统计
  getCostStatistics(filter?: CostFilter): Promise<CostStatistics>;
  
  // 对模型评分
  scoreModel(taskId: string, score: number, reason?: string): Promise<void>;
}
```

---

## 六、UI设计与原型

### 6.1 模型中心页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  模型中心                                           [刷新] [管理]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  类型切换                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │   💬 聊天模型   │  │   🖼️ 图片模型   │  │   🎬 视频模型   │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  模型列表                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 Agnes 2.0 Flash               ⭐ 默认    ✓ 可用       │  │
│  │  快速响应的聊天模型                                        │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  能力：[视觉理解] [Thinking模式] [工具调用] [流式响应]    │  │
│  │  性能：响应时间 500ms | 成功率 99.7% | 并发 100           │  │
│  │  价格：输入 $0.03/1M tokens | 输出 $0.15/1M tokens        │  │
│  │  当前：输入 $0/1M tokens | 输出 $0/1M tokens              │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  统计：总调用 1234次 | 今日 45次 | 本月 320次             │  │
│  │                                                           │  │
│  │                           [查看详情] [设为默认] [评分]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 Agnes 2.0 Pro                            ✓ 可用       │  │
│  │  专业版聊天模型，支持更长的上下文和更复杂的推理            │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  能力：[长上下文] [复杂推理]                              │  │
│  │  性能：响应时间 1200ms | 成功率 99.2% | 并发 50           │  │
│  │                                                           │  │
│  │                           [查看详情] [设为默认] [评分]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.2 模型详情对话框

```
┌─────────────────────────────────────────────────────────────────┐
│  Agnes 2.0 Flash 详情                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  基本信息                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 模型ID：agnes-2.0-flash                                  │   │
│  │ 模型名称：Agnes 2.0 Flash                                │   │
│  │ 类型：聊天模型                                           │   │
│  │ 版本：2.0                                                │   │
│  │ 提供商：Agnes AI                                         │   │
│  │ 状态：可用 ✓                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  API配置                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Endpoint：https://apihub.agnes-ai.com/v1/chat/completions│   │
│  │ 方法：POST                                               │   │
│  │ 请求头：Authorization, Content-Type                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  能力标签                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✅ 视觉理解：支持图像URL输入                              │   │
│  │ ✅ Thinking模式：支持深度思考推理                         │   │
│  │ ✅ 工具调用：支持外部工具集成                             │   │
│  │ ✅ 流式响应：支持实时流式输出                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  参数配置                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 最大上下文：512,000 tokens                               │   │
│  │ 最大输出：65,500 tokens                                  │   │
│  │ 默认温度：0.7 (范围 0-2)                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  价格信息                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 标准价格：                                                │   │
│  │   输入：$0.03 / 1M tokens                                │   │
│  │   输出：$0.15 / 1M tokens                                │   │
│  │                                                          │   │
│  │ 当前价格（免费）：                                        │   │
│  │   输入：$0 / 1M tokens                                   │   │
│  │   输出：$0 / 1M tokens                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  性能指标                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 平均响应时间：500ms                                       │   │
│  │ 成功率：99.7%                                            │   │
│  │ 并发能力：100                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  调用统计                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 总调用次数：1,234次                                       │   │
│  │ 今日调用：45次                                           │   │
│  │ 本周调用：320次                                          │   │
│  │ 本月调用：1,234次                                        │   │
│  │ 最后使用：2026-07-10 14:30                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [关闭]           [设为默认]         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.3 模型选择对话框（专家模式）

```
┌─────────────────────────────────────────────────────────────────┐
│  选择生成模型                                              [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  搜索模型                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🔍 搜索模型名称、能力标签...                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  推荐模型                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 Agnes 2.0 Flash               ⭐ 推荐    ⭐⭐⭐⭐⭐     │  │
│  │  快速响应，适合剧本创作和日常对话                          │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  能力：[视觉理解] [Thinking模式] [工具调用]               │  │
│  │  性能：响应时间 500ms | 成功率 99.7%                      │  │
│  │  价格：当前免费                                            │  │
│  │                                                           │  │
│  │                                    [选择此模型]           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  质量优先                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 Agnes 2.0 Pro                            ⭐⭐⭐⭐⭐     │  │
│  │  专业版，支持更长上下文和复杂推理                          │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  能力：[长上下文 8K] [复杂推理]                           │  │
│  │  性能：响应时间 1200ms | 成功率 99.2%                     │  │
│  │                                                           │  │
│  │                                    [选择此模型]           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  深度思考                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 Agnes 2.0 Thinking                        ⭐⭐⭐⭐⭐     │  │
│  │  Thinking模式，支持长链推理和深度分析                      │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  能力：[Thinking模式] [深度推理] [长上下文 16K]           │  │
│  │  性能：响应时间 3000ms | 成功率 98.8%                     │  │
│  │                                                           │  │
│  │                                    [选择此模型]           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [取消]                             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.4 管理员配置页面

```
┌─────────────────────────────────────────────────────────────────┐
│  模型中心管理                                              [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │   📋 模型池    │  │   ⚙️ 默认配置  │  │   🔐 权限管理  │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  模型池管理（当前选中）                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  💬 聊天模型                                              │  │
│  │  ──────────────────────────────────────────────────────  │  │
│  │  Agnes 2.0 Flash      [启用] ✓  [默认] ⭐  [配置]        │  │
│  │  Agnes 2.0 Pro        [启用] ✓            [配置]        │  │
│  │  Agnes 2.0 Thinking   [禁用] ✗            [配置]        │  │
│  │                                                           │  │
│  │  🖼️ 图片模型                                              │  │
│  │  ──────────────────────────────────────────────────────  │  │
│  │  Agnes Image 2.1 Flash [启用] ✓  [默认] ⭐  [配置]        │  │
│  │  Agnes Image Pro       [启用] ✓            [配置]        │  │
│  │  Custom ComfyUI        [禁用] ✗            [配置]        │  │
│  │                                                           │  │
│  │  🎬 视频模型                                              │  │
│  │  ──────────────────────────────────────────────────────  │  │
│  │  Agnes Video V2.0     [启用] ✓  [默认] ⭐  [配置]        │  │
│  │  Agnes Video V2.0 Pro [禁用] ✗            [配置]        │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [+ 添加新模型]                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [关闭]                             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.5 模型注册对话框

```
┌─────────────────────────────────────────────────────────────────┐
│  注册新模型                                               [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  基本信息                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 模型ID*：        [agnes-2.0-flash                   ]    │  │
│  │ 模型名称*：      [Agnes 2.0 Flash                    ]    │  │
│  │ 模型类型*：      [聊天模型 ▼]                           │  │
│  │ 模型描述：       [快速响应的聊天模型...              ]    │  │
│  │ 版本：           [2.0                                 ]    │  │
│  │ 提供商：         [Agnes AI                            ]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  API配置                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ API Endpoint*：  [https://apihub.agnes-ai.com/v1/chat...│  │
│  │ HTTP方法*：      [POST ▼]                               │  │
│  │ 自定义请求头：   [Authorization: Bearer YOUR_API_KEY   ]  │  │
│  │ 状态查询Endpoint：[                                    ]  │  │
│  │                  （视频模型必填）                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  能力标签                                                       │
│  ☑ 视觉理解支持                                                │
│  ☑ Thinking模式支持                                            │
│  ☑ 工具调用支持                                                │
│  ☑ 流式响应支持                                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  参数配置                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 最大上下文：     [512000                              ]    │  │
│  │ 最大输出token：  [65500                               ]    │  │
│  │ 默认温度：       [0.7]  范围：0 - 2                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  价格信息                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 标准价格：                                                │  │
│  │   输入：    [$0.03 / 1M tokens                     ]    │  │
│  │   输出：    [$0.15 / 1M tokens                     ]    │  │
│  │                                                          │  │
│  │ 当前价格：                                                │  │
│  │   输入：    [$0 / 1M tokens                        ]    │  │
│  │   输出：    [$0 / 1M tokens                        ]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [取消]           [保存配置]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、实施计划

### 7.1 第一阶段（P0优先级）

#### 7.1.1 后端开发

**核心任务**:
- [ ] 扩展 `ModelConfig` 类型定义（添加 `apiConfig`、`capabilities`、`parameterRules`、`pricing`）
- [ ] 实现数据库表结构（6个核心表）
- [ ] 实现模型注册与管理API
- [ ] 实现统一模型调用接口
- [ ] 实现参数验证逻辑（含8n+1规则验证）
- [ ] 实现异步任务管理（视频模型轮询）
- [ ] 实现调用记录保存

**关键文件**:
- `backend/src/types.ts`: 扩展 ModelConfig 类型
- `backend/src/storage/schema.ts`: 添加数据库表结构
- `backend/src/services/model-center.ts`: 实现模型中心服务
- `backend/src/http/models-router.ts`: 扩展模型路由

---

#### 7.1.2 前端开发

**核心任务**:
- [ ] 实现模型中心页面布局
- [ ] 实现模型列表展示（含能力标签、价格、性能）
- [ ] 实现模型详情对话框
- [ ] 实现模型选择对话框（专家模式）
- [ ] 实现管理员配置页面
- [ ] 实现模型注册对话框

**关键文件**:
- `frontend/components/dashboard/model-center.tsx`: 扩展模型中心组件
- `frontend/components/model/model-detail-dialog.tsx`: 新建模型详情对话框
- `frontend/components/model/model-select-dialog.tsx`: 新建模型选择对话框
- `frontend/components/model/model-config-dialog.tsx`: 新建模型注册对话框

---

### 7.2 第二阶段（P1优先级）

#### 7.2.1 智能模型推荐

**核心任务**:
- [ ] 实现智能推荐算法
- [ ] 实现任务类型识别
- [ ] 实现模型匹配逻辑
- [ ] 实现推荐权重计算（含用户评分）

---

#### 7.2.2 权限与配额控制

**核心任务**:
- [ ] 实现模型访问权限验证
- [ ] 实现用户配额限制
- [ ] 实现配额自动重置
- [ ] 实现成本估算逻辑
- [ ] 实现成本预算控制

---

### 7.3 第三阶段（P2优先级）

#### 7.3.1 统计与分析

**核心任务**:
- [ ] 实现调用统计计算
- [ ] 实现成本统计计算
- [ ] 实现性能分析计算
- [ ] 实现统计图表展示
- [ ] 实现模型评分系统

---

#### 7.3.2 管理员高级功能

**核心任务**:
- [ ] 实现企业模型池管理
- [ ] 实现默认模型配置
- [ ] 实现用户权限配置
- [ ] 实现成本策略配置

---

### 7.4 实施检查清单

#### 数据库设计
- [ ] 创建 `model_configs` 表
- [ ] 创建 `model_call_records` 表
- [ ] 创建 `model_scores` 表
- [ ] 创建 `user_quotas` 表
- [ ] 创建 `user_budgets` 表
- [ ] 创建 `model_permissions` 表
- [ ] 创建所有索引

#### 类型定义
- [ ] 扩展 `ModelConfig` 类型（apiConfig、capabilities、parameterRules、pricing）
- [ ] 定义 `ModelCallRequest` 类型
- [ ] 定义 `ModelCallResponse` 类型
- [ ] 定义 `AsyncTaskStatus` 类型
- [ ] 定义 `ModelStatistics` 类型
- [ ] 定义 `CostStatistics` 类型

#### 后端服务
- [ ] 实现模型注册服务
- [ ] 实现模型调用服务
- [ ] 实现参数验证服务
- [ ] 实现异步任务管理服务
- [ ] 实现调用记录服务
- [ ] 实现智能推荐服务
- [ ] 实现权限验证服务
- [ ] 实现配额管理服务
- [ ] 实现统计计算服务

#### 前端组件
- [ ] 实现模型中心页面
- [ ] 实现模型详情对话框
- [ ] 实现模型选择对话框
- [ ] 实现模型注册对话框
- [ ] 实现管理员配置页面
- [ ] 实现统计图表组件

#### API集成
- [ ] 集成 Agnes 2.0 Flash API
- [ ] 集成 Agnes Image 2.1 Flash API
- [ ] 集成 Agnes Video V2.0 API
- [ ] 实现异步任务状态查询

---

## 附录：相关文档

- **AI模型体系设计**: [06-ai-model-system.md](file:///d:/trae/manju/docs/06-ai-model-system.md)
- **剧本中心完整指南**: [script-center-guide.md](file:///d:/trae/manju/docs/script-center-guide.md)
- **API规格说明书**: [api-specification.md](file:///d:/trae/manju/docs/api-specification.md)
- **数据模型设计**: [04-data-model.md](file:///d:/trae/manju/docs/04-data-model.md)

---

## 总结

模型中心是AI漫剧平台的核心基础设施，负责管理所有AI模型、提供智能推荐、记录调用统计、控制权限配额。

**核心设计原则**:
- ✅ 任务优先，而不是模型优先
- ✅ 普通用户使用智能模式，专业用户使用专家模式
- ✅ 管理员配置企业模型池和权限策略
- ✅ 支持三种模型类型：聊天、图片、视频
- ✅ 支持特殊功能：视觉理解、Thinking模式、关键帧模式、异步生成

**关键特性**:
- ✅ 完整的模型配置管理（API、能力标签、参数约束、价格）
- ✅ 统一的模型调用接口（支持三种模型类型）
- ✅ 智能模型推荐算法（质量、成本、时间）
- ✅ 完整的调用记录和统计分析
- ✅ 权限控制和配额限制
- ✅ 用户评分系统和模型质量评价

---

**文档位置**: `d:\trae\manju\docs\model-center-guide.md`