import { chromium } from 'playwright';

const url = process.env.SHOWCASE_URL || 'http://localhost:4173';
const label = process.argv[2] || 'Csg Box';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(800);
await page.locator('select').first().selectOption({ label });
await page.waitForTimeout(2000); // parse + resource load + auto-fit settle
await page.screenshot({ path: 'docs/showcase/_verify.png' });
await browser.close();
console.log(`verify screenshot saved for "${label}"`);
