import { recordShowcase } from './record.mjs';

await recordShowcase('_smoke', async (page, { orbit }) => {
  await orbit(page, { dx: 200, dy: 30, steps: 40 });
  await page.waitForTimeout(400);
});
