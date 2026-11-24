import { RENDER_TIMEOUT_MS } from './pollInk.mjs';

/** Software GL draws a frame in well under this, so two shots this far apart that match show a still view. */
const STILL_INTERVAL_MS = 1000;

/** A shot of `#viewport` once two shots in a row match, so the view has drawn what it will draw. */
export async function stillShot(page) {
  const viewport = page.locator('#viewport');
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let shot = await viewport.screenshot();
  for (;;) {
    await page.waitForTimeout(STILL_INTERVAL_MS);
    const next = await viewport.screenshot();
    if (next.equals(shot) || Date.now() > deadline) return next;
    shot = next;
  }
}
