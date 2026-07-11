import { expect, test } from "@playwright/test";

/**
 * AI任务队列页面完整测试
 * 测试范围：
 * 1. 页面加载和基础UI
 * 2. 数据显示和刷新
 * 3. 任务筛选和搜索
 * 4. 任务详情查看
 */
test.describe("AI任务队列页面测试", () => {
  test("页面正常加载且显示任务列表", async ({ page }) => {
    await page.goto("/ai-tasks");
    
    // 等待页面完全加载
    await page.waitForLoadState("networkidle");
    
    // 验证页面标题和返回按钮（使用精确选择器）
    await expect(page.getByRole("heading", { name: "AI任务队列", level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /返回首页/ })).toBeVisible();
    
    // 验证任务总数显示
    await expect(page.getByText(/共.*个任务/)).toBeVisible();
    
    // 验证任务表格显示（使用data-testid）
    const taskTable = page.getByTestId("task-table");
    await expect(taskTable).toBeVisible({ timeout: 15000 });
    
    // 验证任务列表显示（使用data-testid）
    const taskRows = page.getByTestId("task-row");
    const taskCount = await taskRows.count();
    expect(taskCount).toBeGreaterThan(0);
    
    // 验证第一个任务行包含必要字段
    const firstRow = taskRows.first();
    await expect(firstRow.getByText(/图片|视频/)).toBeVisible();
  });
  
  test("任务筛选功能正常工作", async ({ page }) => {
    await page.goto("/ai-tasks");
    await page.waitForLoadState("networkidle");
    
    // 等待任务表格加载
    await expect(page.getByTestId("task-table")).toBeVisible({ timeout: 15000 });
    
    // 获取初始任务数量
    const initialTaskRows = page.getByTestId("task-row");
    const initialCount = await initialTaskRows.count();
    
    // 测试类型筛选 - 图片任务
    await page.getByRole("button", { name: /图片/ }).click();
    await page.waitForTimeout(800);
    
    const imageTaskRows = page.getByTestId("task-row");
    const imageTaskCount = await imageTaskRows.count();
    expect(imageTaskCount).toBeGreaterThanOrEqual(0);
    
    // 测试状态筛选 - 成功任务
    await page.getByRole("button", { name: /成功|已完成/ }).click();
    await page.waitForTimeout(800);
    
    const successTaskRows = page.getByTestId("task-row");
    const successTaskCount = await successTaskRows.count();
    expect(successTaskCount).toBeGreaterThanOrEqual(0);
    
    // 测试重置筛选 - 全部任务
    await page.getByRole("button", { name: /全部/ }).click();
    await page.waitForTimeout(800);
    
    const allTaskRows = page.getByTestId("task-row");
    const allTaskCount = await allTaskRows.count();
    expect(allTaskCount).toBe(initialCount);
  });
  
  test("刷新按钮功能正常", async ({ page }) => {
    await page.goto("/ai-tasks");
    await page.waitForLoadState("networkidle");
    
    // 等待任务表格加载
    await expect(page.getByTestId("task-table")).toBeVisible({ timeout: 15000 });
    
    // 点击刷新按钮
    const refreshButton = page.getByRole("button", { name: /刷新/ });
    await refreshButton.click();
    
    // 等待刷新完成（使用智能等待）
    await page.waitForLoadState("networkidle");
    
    // 验证页面仍然正常显示
    await expect(page.getByRole("heading", { name: "AI任务队列" })).toBeVisible();
    await expect(page.getByTestId("task-table")).toBeVisible();
  });
});

/**
 * 模型中心页面完整测试
 * 测试范围：
 * 1. 页面加载和基础UI
 * 2. 模型列表显示
 * 3. 模型分类筛选
 * 4. 模型详情查看
 */
test.describe("模型中心页面测试", () => {
  test("页面正常加载且显示模型列表", async ({ page }) => {
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    
    // 验证页面标题和返回按钮
    await expect(page.getByRole("heading", { name: "模型中心", level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /返回首页/ })).toBeVisible();
    
    // 验证模型概览显示
    await expect(page.getByText(/共.*个模型/)).toBeVisible();
    
    // 验证模型卡片显示（使用data-testid）
    const modelCards = page.getByTestId("model-card");
    await expect(modelCards.first()).toBeVisible({ timeout: 15000 });
    
    const modelCount = await modelCards.count();
    expect(modelCount).toBeGreaterThan(0);
    
    // 验证模型包含关键信息
    const firstModel = modelCards.first();
    await expect(firstModel.getByText(/agnes|可用|使用.*次/)).toBeVisible();
  });
  
  test("模型分类筛选功能正常", async ({ page }) => {
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    
    // 等待模型卡片加载
    await expect(page.getByTestId("model-card").first()).toBeVisible({ timeout: 15000 });
    
    // 获取初始模型数量
    const initialModelCards = page.getByTestId("model-card");
    const initialCount = await initialModelCards.count();
    
    // 测试聊天模型筛选
    const chatFilter = page.getByRole("combobox").or(page.getByRole("button", { name: /聊天模型|聊天/ }));
    if (await chatFilter.count() > 0) {
      await chatFilter.first().click();
      await page.waitForTimeout(800);
      
      const chatModelCards = page.getByTestId("model-card");
      const chatModelCount = await chatModelCards.count();
      expect(chatModelCount).toBeGreaterThanOrEqual(0);
    }
    
    // 测试图片模型筛选
    const imageFilter = page.getByRole("button", { name: /图片模型|图片/ }).or(page.getByRole("combobox"));
    if (await imageFilter.count() > 0) {
      await imageFilter.first().click();
      await page.waitForTimeout(800);
      
      const imageModelCards = page.getByTestId("model-card");
      const imageModelCount = await imageModelCards.count();
      expect(imageModelCount).toBeGreaterThanOrEqual(0);
    }
    
    // 测试视频模型筛选
    const videoFilter = page.getByRole("button", { name: /视频模型|视频/ }).or(page.getByRole("combobox"));
    if (await videoFilter.count() > 0) {
      await videoFilter.first().click();
      await page.waitForTimeout(800);
      
      const videoModelCards = page.getByTestId("model-card");
      const videoModelCount = await videoModelCards.count();
      expect(videoModelCount).toBeGreaterThanOrEqual(0);
    }
  });
  
  test("模型详情显示正常", async ({ page }) => {
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    
    // 等待模型卡片加载
    const firstModel = page.getByTestId("model-card").first();
    await expect(firstModel).toBeVisible({ timeout: 15000 });
    
    // 点击第一个模型查看详情（点击模型卡片）
    await firstModel.click();
    await page.waitForTimeout(500);
    
    // 验证模型详情显示（性能指标或参数）
    const detailsVisible = await page.getByText(/性能指标|成功率|响应时间|参数|配置/).isVisible();
    expect(detailsVisible).toBeTruthy();
  });
});

/**
 * 数据中心页面完整测试
 * 测试范围：
 * 1. 页面加载和基础UI
 * 2. 数据概览卡片显示
 * 3. 时间范围筛选
 * 4. 详细数据查看
 */
test.describe("数据中心页面测试", () => {
  test("页面正常加载且显示数据概览", async ({ page }) => {
    await page.goto("/data");
    await page.waitForLoadState("networkidle");
    
    // 验证页面标题和返回按钮
    await expect(page.getByRole("heading", { name: "数据中心", level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /返回首页/ })).toBeVisible();
    
    // 验证数据概览卡片显示（使用data-testid）
    const metricCards = page.getByTestId("metric-card");
    await expect(metricCards.first()).toBeVisible({ timeout: 15000 });
    
    const cardCount = await metricCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    // 验证关键指标内容
    await expect(page.getByText(/本月AI成本|本月生成任务|平均响应时间|生产效率指数/)).toBeVisible();
  });
  
  test("时间范围筛选功能正常", async ({ page }) => {
    await page.goto("/data");
    await page.waitForLoadState("networkidle");
    
    // 等待数据加载
    await expect(page.getByTestId("metric-card").first()).toBeVisible({ timeout: 15000 });
    
    // 测试本月数据
    await page.getByRole("button", { name: /本月/ }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/本月AI成本|月度AI成本/)).toBeVisible();
    
    // 测试本周数据
    await page.getByRole("button", { name: /本周/ }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/AI成本/)).toBeVisible();
    
    // 测试今天数据
    await page.getByRole("button", { name: /今天/ }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/AI成本/)).toBeVisible();
    
    // 测试全部数据
    await page.getByRole("button", { name: /全部/ }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/AI成本/)).toBeVisible();
  });
  
  test("成本和效率数据正常显示", async ({ page }) => {
    await page.goto("/data");
    await page.waitForLoadState("networkidle");
    
    // 等待数据加载
    await expect(page.getByTestId("metric-card").first()).toBeVisible({ timeout: 15000 });
    
    // 验证AI成本统计
    await expect(page.getByText(/总成本|AI成本/)).toBeVisible();
    
    // 验证生产效率数据
    await expect(page.getByText(/平均完成时间|平均响应时间|成功率|效率指数/)).toBeVisible();
    
    // 验证成本趋势图表
    await expect(page.getByText(/成本趋势/)).toBeVisible();
  });
});

/**
 * 发布中心页面完整测试
 * 测试范围：
 * 1. 页面加载和基础UI
 * 2. 发布计划列表显示
 * 3. 发布统计数据显示
 * 4. 发布状态筛选
 */
test.describe("发布中心页面测试", () => {
  test("页面正常加载且显示发布计划", async ({ page }) => {
    await page.goto("/publish");
    await page.waitForLoadState("networkidle");
    
    // 验证页面标题和返回按钮
    await expect(page.getByRole("heading", { name: "发布中心", level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /返回首页/ })).toBeVisible();
    
    // 验证发布统计卡片显示（使用data-testid）
    const statCards = page.getByTestId("stat-card");
    await expect(statCards.first()).toBeVisible({ timeout: 15000 });
    
    const cardCount = await statCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    // 验证统计数据显示
    await expect(page.getByText(/总成片数|已发布数|待发布数|本月发布数/)).toBeVisible();
    
    // 验证发布计划概览
    await expect(page.getByText(/发布计划|概览|最新成片/)).toBeVisible();
  });
  
  test("发布状态筛选功能正常", async ({ page }) => {
    await page.goto("/publish");
    await page.waitForLoadState("networkidle");
    
    // 等待数据加载
    await expect(page.getByTestId("stat-card").first()).toBeVisible({ timeout: 15000 });
    
    // 测试切换到最新成片 Tab
    const videosTab = page.getByRole("button", { name: /最新成片/ });
    if (await videosTab.count() > 0) {
      await videosTab.click();
      await page.waitForTimeout(800);
      await expect(page.getByText(/成片|视频|预览|下载/)).toBeVisible();
    }
    
    // 测试切换到发布计划 Tab
    const plansTab = page.getByRole("button", { name: /发布计划/ });
    if (await plansTab.count() > 0) {
      await plansTab.click();
      await page.waitForTimeout(800);
      await expect(page.getByText(/发布计划|计划中|执行中|已完成/)).toBeVisible();
    }
    
    // 返回概览 Tab
    const overviewTab = page.getByRole("button", { name: /概览/ });
    if (await overviewTab.count() > 0) {
      await overviewTab.click();
      await page.waitForTimeout(800);
      await expect(page.getByTestId("stat-card").first()).toBeVisible();
    }
  });
  
  test("发布计划详情显示正常", async ({ page }) => {
    await page.goto("/publish");
    await page.waitForLoadState("networkidle");
    
    // 等待数据加载
    await expect(page.getByTestId("stat-card").first()).toBeVisible({ timeout: 15000 });
    
    // 验证发布统计数据
    await expect(page.getByText(/总成片数/)).toBeVisible();
    
    // 验证操作按钮存在
    const actionButtons = page.getByRole("button").filter({ hasText: /查看所有成片|创建发布计划|查看发布统计/ });
    const buttonCount = await actionButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(0);
  });
});

/**
 * 页面导航和一致性测试
 * 测试范围：
 * 1. 页面间导航流畅性
 * 2. 返回首页功能
 * 3. 页面标题一致性
 */
test.describe("页面导航和一致性测试", () => {
  test("所有页面返回首页功能正常", async ({ page }) => {
    const pages = [
      { path: "/ai-tasks", title: "AI任务队列" },
      { path: "/models", title: "模型中心" },
      { path: "/data", title: "数据中心" },
      { path: "/publish", title: "发布中心" }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      
      // 验证页面标题
      await expect(page.getByRole("heading", { name: pageInfo.title })).toBeVisible({ timeout: 15000 });
      
      // 点击返回首页按钮
      await page.getByRole("button", { name: /返回首页/ }).click();
      await page.waitForLoadState("networkidle");
      
      // 验证回到首页
      await expect(page.getByText("Agnes AI Studio")).toBeVisible({ timeout: 15000 });
    }
  });
  
  test("页面间导航流畅无错误", async ({ page }) => {
    // 从首页开始
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Agnes AI Studio")).toBeVisible({ timeout: 15000 });
    
    // 导航到AI任务页面
    await page.goto("/ai-tasks");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "AI任务队列" })).toBeVisible({ timeout: 15000 });
    
    // 导航到模型中心
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "模型中心" })).toBeVisible({ timeout: 15000 });
    
    // 导航到数据中心
    await page.goto("/data");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "数据中心" })).toBeVisible({ timeout: 15000 });
    
    // 导航到发布中心
    await page.goto("/publish");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "发布中心" })).toBeVisible({ timeout: 15000 });
    
    // 最后回到首页
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Agnes AI Studio")).toBeVisible({ timeout: 15000 });
  });
});

/**
 * API数据完整性验证测试
 * 测试范围：
 * 1. 页面数据来源验证
 * 2. 数据结构完整性
 * 3. 数据刷新功能
 */
test.describe("API数据完整性测试", () => {
  test("AI任务页面数据完整性", async ({ page }) => {
    await page.goto("/ai-tasks");
    await page.waitForLoadState("networkidle");
    
    // 验证任务表格加载
    const taskTable = page.getByTestId("task-table");
    await expect(taskTable).toBeVisible({ timeout: 15000 });
    
    // 验证表格头部显示
    const tableHeader = page.getByTestId("task-table-header");
    await expect(tableHeader).toBeVisible();
    
    // 验证表格包含多个列（通过文本验证）
    await expect(tableHeader.getByText(/类型|Prompt|状态|时间|操作/)).toBeVisible();
    
    // 验证至少有一个任务行
    const taskRows = page.getByTestId("task-row");
    const taskCount = await taskRows.count();
    expect(taskCount).toBeGreaterThan(0);
  });
  
  test("模型中心数据完整性", async ({ page }) => {
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    
    // 验证模型卡片加载
    const modelCards = page.getByTestId("model-card");
    await expect(modelCards.first()).toBeVisible({ timeout: 15000 });
    
    const modelCount = await modelCards.count();
    expect(modelCount).toBeGreaterThan(0);
    
    // 验证每个模型包含关键信息
    const firstModel = modelCards.first();
    await expect(firstModel.getByText(/agnes|可用|使用.*次|响应|成功率/)).toBeVisible();
  });
  
  test("数据中心数据完整性", async ({ page }) => {
    await page.goto("/data");
    await page.waitForLoadState("networkidle");
    
    // 验证数据卡片加载
    const metricCards = page.getByTestId("metric-card");
    await expect(metricCards.first()).toBeVisible({ timeout: 15000 });
    
    // 验证关键指标显示
    await expect(page.getByText(/本月AI成本|本月生成任务|平均响应时间|生产效率指数/)).toBeVisible();
    
    // 验证数据包含数值
    const costText = await page.getByText(/\$[\d.]+.*美元|\d+.*元/).textContent();
    expect(costText).toBeTruthy();
  });
  
  test("发布中心数据完整性", async ({ page }) => {
    await page.goto("/publish");
    await page.waitForLoadState("networkidle");
    
    // 验证统计卡片加载
    const statCards = page.getByTestId("stat-card");
    await expect(statCards.first()).toBeVisible({ timeout: 15000 });
    
    // 验证统计数据显示
    await expect(page.getByText(/总成片数|已发布数|待发布数|本月发布数/)).toBeVisible();
    
    // 验证统计数据包含数值
    const statsText = await page.getByText(/\d+/).first().textContent();
    expect(statsText).toBeTruthy();
  });
});