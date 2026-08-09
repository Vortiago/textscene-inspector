import { launchShowcaseBrowser } from './browser.mjs';
import { selectScene } from './record/helpers.mjs';

const url = process.env.SHOWCASE_URL || 'http://localhost:4173';
const label = process.argv[2] || 'Csg Box';

const browser = await launchShowcaseBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(800);
await selectScene(page, label);
await page.waitForTimeout(700); // extra auto-fit settle beyond selectScene's own wait
await page.screenshot({ path: 'docs/showcase/_verify.png' });
await browser.close();
console.log(`verify screenshot saved for "${label}"`);
