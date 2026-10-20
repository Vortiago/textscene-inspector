/**
 * A PNG of one capture target, read from the compositor through the DevTools protocol. It gives
 * the bytes Playwright's element screenshot gives. That screenshot first scrolls, waits for a
 * stable box and hides the caret, and each step waits on a main thread that SwiftShader keeps
 * busy: 4 to 7 s a shot on a 3D golden, against under 1 s here.
 */

/** Playwright's default action timeout, which the element screenshot used when a scene set none. */
const DEFAULT_SHOT_TIMEOUT_MS = 30000;

/** Written only by `cdpSessionOf`. An entry goes with its page. */
const cdpSessions = new WeakMap();

/**
 * The target's whole-pixel box as a PNG buffer. Rejects with a `TimeoutError` when the shot
 * outlasts `timeout`, as Playwright's own screenshot does.
 *
 * @param {import('playwright').Locator} target - the canvas, or the 2D frame, in the page or a frame.
 * @param {{ timeout?: number }} [options]
 */
export async function shootTarget(target, { timeout = DEFAULT_SHOT_TIMEOUT_MS } = {}) {
  const box = await target.boundingBox({ timeout });
  if (!box) throw new Error('expected a visible capture target, but the capture target is not visible');
  const session = await cdpSessionOf(target.page());
  const clip = { ...enclosingIntRect(box), scale: 1 };
  const { data } = await withTimeout(
    session.send('Page.captureScreenshot', { format: 'png', clip }),
    timeout
  );
  return Buffer.from(data, 'base64');
}

function cdpSessionOf(page) {
  if (!cdpSessions.has(page)) cdpSessions.set(page, page.context().newCDPSession(page));
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
