import { inkStats } from '../vscode/pixels.mjs';

/** Software GL draws the first frame slowly. */
export const RENDER_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;

/** The ink of `#viewport` once `isDone` holds for it, or at the timeout. It polls, since software GL is slow. */
export async function pollInk(page, isDone) {
  const viewport = page.locator('#viewport');
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let ink = inkStats(await viewport.screenshot()).inkPixels;
  while (!isDone(ink) && Date.now() < deadline) {
    await page.waitForTimeout(POLL_INTERVAL_MS);
    ink = inkStats(await viewport.screenshot()).inkPixels;
  }
  return ink;
}
