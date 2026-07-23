import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1366, height: 768 } });

test("1366×768 最小工作区无页面级横向溢出且主内容可聚焦", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page.locator("#main-content")).toBeVisible();
  await page.locator(".skip-to-content").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
});
