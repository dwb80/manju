import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserCache = path.join(root, ".playwright-browsers");
if (fs.existsSync(browserCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;

const { chromium } = await import(pathToFileURL(path.join(root, "frontend", "node_modules", "playwright", "index.mjs")));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const file = path.join(root, "docs", "implementation", "04-prototypes", "index.html");
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("[data-state=conflict]").click();
  const activeState = await page.locator("[data-state].active").getAttribute("data-state");
  if (activeState !== "conflict") throw new Error(`state interaction failed: expected conflict, got ${activeState}`);
  const pageCount = await page.locator("#nav button").count();
  if (pageCount < 20) throw new Error(`prototype catalog unexpectedly small: ${pageCount}`);
  await page.locator("#nav button").nth(pageCount - 1).click();
  if (!(await page.locator("#route").textContent())?.startsWith("/")) throw new Error("page navigation did not update the route");
  const output = path.join(root, "artifacts", "implementation-readiness-prototype.png");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Rendered and exercised ${pageCount} prototype pages to ${path.relative(root, output)}.`);
} finally {
  await browser.close();
}
