/**
 * A PNG of one capture target, read from the compositor through the DevTools protocol. It gives
 * the bytes Playwright's element screenshot gives. That screenshot first scrolls, waits for a
 * stable box and hides the caret, and each step waits on a main thread that SwiftShader keeps
 * busy: 4 to 7 s a shot on a 3D golden, against under 1 s here.
 */

/* global window */ // used only inside the page.evaluate callback, which runs in the browser.

/** Playwright's default action timeout, which the element screenshot used when a scene set none. */
const DEFAULT_SHOT_TIMEOUT_MS = 30000;

/** Written only by `cdpSessionOf`. An entry goes with its page, or with a session that failed to open. */
const cdpSessions = new WeakMap();

/**
 * Shoots the target's whole-pixel box as a PNG buffer. `shoot` scrolls the target into view and
 * measures its box once, at its first call, so later shots skip the main-thread wait. `boxChanged`
 * measures again and answers whether the box moved since, so a caller can prove a matching pair
 * is no crop of a resized target. A call rejects with a `TimeoutError` when it outlasts `timeout`,
 * as Playwright's own screenshot does, and a `timeout` of 0 waits without limit, as Playwright's does.
 *
 * @param {import('playwright').Locator} target - the canvas, or the 2D frame, in the page or a frame.
 * @param {{ timeout?: number }} [options]
 * @returns {{ shoot: () => Promise<Buffer>, boxChanged: () => Promise<boolean> }}
 */
export function targetShooter(target, { timeout = DEFAULT_SHOT_TIMEOUT_MS } = {}) {
  let clip;
  return {
    async shoot() {
      clip ??= await clipOf(target, timeout);
      const session = await cdpSessionOf(target.page());
      const { data } = await withTimeout(
        session.send('Page.captureScreenshot', { format: 'png', clip }),
        timeout
      );
      return Buffer.from(data, 'base64');
    },
    async boxChanged() {
      const measured = await clipOf(target, timeout);
      const changed = ['x', 'y', 'width', 'height'].some((key) => measured[key] !== clip?.[key]);
      clip = measured;
      return changed;
    },
  };
}

/**
 * The target's box in document coordinates, which `Page.captureScreenshot` clips by. Playwright's
 * box is relative to the viewport, so a scrolled page adds its scroll offset.
 */
async function clipOf(target, timeout) {
  await target.scrollIntoViewIfNeeded({ timeout });
  const box = await target.boundingBox({ timeout });
  if (!box) throw new Error('expected a visible capture target, but the capture target is not visible');
  const scroll = await target.page().evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  return { ...enclosingIntRect({ ...box, x: box.x + scroll.x, y: box.y + scroll.y }), scale: 1 };
}

function cdpSessionOf(page) {
  if (!cdpSessions.has(page)) {
    const session = page.context().newCDPSession(page);
    // A session that failed to open is not cached, so the next shot tries again.
    session.catch(() => cdpSessions.delete(page));
    cdpSessions.set(page, session);
  }
  return cdpSessions.get(page);
}

/** Playwright's rounding of an element's box, so a fractional 2D frame clips the same pixels. */
function enclosingIntRect({ x, y, width, height }) {
  const left = Math.floor(x + 1e-3);
  const top = Math.floor(y + 1e-3);
  const right = Math.ceil(x + width - 1e-3);
  const bottom = Math.ceil(y + height - 1e-3);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function withTimeout(promise, timeout) {
  if (timeout === 0) return promise;
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`capture target screenshot: timeout ${timeout}ms exceeded`);
      error.name = 'TimeoutError';
      reject(error);
    }, timeout);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}
