import { expect, test } from "@playwright/test";

// 验证核心创作流程仍可用：聊天、图片生成、图片详情和视频任务提交。
test("chat, image, video and detail pages stay usable", async ({ page, context }) => {
  await page.goto("/studio");
  await expect(page.getByText("Agnes AI Studio")).toBeVisible();
  await expect(page.locator("aside").getByRole("button", { name: "打开会话操作菜单" }).first()).toBeVisible();

  const composer = page.locator("textarea");
  await composer.fill("E2E 聊天连通性测试");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.locator("section").getByText("E2E 聊天连通性测试", { exact: true })).toBeVisible();
  await expect(page.getByText(/测试回复：E2E 聊天连通性测试/)).toBeVisible();

  await page.getByRole("button", { name: /图片/ }).click();
  await composer.fill("E2E 生成一张绿色工作台图片");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("E2E 生成一张绿色工作台图片")).toBeVisible();
  await expect(page.getByText(/正在生成图片|图片已生成/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /查看/ }).first()).toBeVisible();

  const imagePagePromise = context.waitForEvent("page");
  await page.getByRole("button", { name: /查看/ }).first().click();
  const imagePage = await imagePagePromise;
  await imagePage.waitForLoadState("domcontentloaded");
  await expect(imagePage.getByText("图片详情")).toBeVisible();
  await expect(imagePage.getByText("提示词")).toBeVisible();
  await imagePage.close();

  await page.getByRole("button", { name: /视频/ }).click();
  await composer.fill("E2E 生成一个镜头推进视频");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("E2E 生成一个镜头推进视频")).toBeVisible();
  await expect(page.getByText("视频任务已提交").first()).toBeVisible();
});

// 验证新建会话不会把上一个会话的图片请求展示状态清空。
test("new conversation keeps the previous conversation discoverable", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator("aside").getByRole("button", { name: "打开会话操作菜单" }).first()).toBeVisible();
  await page.locator("textarea").fill("E2E 会话隔离聊天请求");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.locator("section").getByText("E2E 会话隔离聊天请求", { exact: true })).toBeVisible();

  const menusBefore = await page.locator("aside").getByRole("button", { name: "打开会话操作菜单" }).count();
  await page.locator("aside").getByRole("button").first().click();
  await expect(page.locator("textarea")).toBeVisible();
  await expect(page.locator("aside").getByRole("button", { name: "打开会话操作菜单" })).toHaveCount(menusBefore + 1);
});
