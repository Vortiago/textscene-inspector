/**
 * Opening a fixture and getting one trustworthy frame out of it: the app's own
 * resource chain awaited, the requested scene confirmed, and the canvas proven
 * settled before it is read.
 */

import {
  NETWORK_IDLE_MS,
  SETTLE_INITIAL_MS,
  SETTLE_INTERVAL_MS,
  SETTLE_MAX_ATTEMPTS,
} from './appContract.mjs';
import { findCanvas2DFrame } from './viewportProbes.mjs';

/**
 * Navigate to a fixture and wait for the app's OWN resource chain to go quiet.
 * `load` fires well before that chain finishes — a scene fetches its .tscn,
 * then an ArrayMesh .tres, then that surface's material, then the material's
 * texture, each only discoverable once the previous one parsed. Without this
 * the settle gate below happily finds two identical frames of the untextured
 * placeholder. A scene that never idles still falls through to the gate.
 */
export async function gotoFixture(page, baseUrl, fixture, onSlow = () => {}, extraParams = {}) {
  let url = `${baseUrl}/?fixture=${encodeURIComponent(fixture)}`;
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null) url += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
  }
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch((err) => {
    // Anything that is NOT a timeout (crashed target, closed page) is a real
    // failure and must not be mistaken for one.
    if (err?.name !== 'TimeoutError') throw err;
    onSlow(NETWORK_IDLE_MS);
  });
  assertOpenedFixture(page, fixture);
}

/**
 * Fail when the app did not open the fixture we asked for.
 *
 * `useFixtureSelection` validates `?fixture=` against the catalog and silently falls back
 * to the stored or default scene when it does not match — correct for a shared link, fatal
 * for a measurement. It writes the scene it actually opened back into the URL, so the
 * post-load query string is the app's own answer to "what am I showing?". Without this a
 * mistyped or wrongly-derived name yields a confident number for the wrong scene.
 */
function assertOpenedFixture(page, requested) {
  const opened = new URL(page.url()).searchParams.get('fixture');
  if (opened === requested) return;
  throw new Error(
    `previewer opened "${opened ?? '(none)'}" but "${requested}" was requested — ` +
      'the name must match apps/textscene-web/src/fixtures.ts exactly ' +
      '(run `pnpm generate:fixtures` if the scene is new)'
  );
}

/** The single canvas the scene renders into, or a reason there isn't exactly one. */
export async function findCanvas(page) {
  const canvases = page.locator('canvas');
  try {
    // 90s: under host contention (parallel agents + software GL) a healthy
    // scene can take over 30s to first paint. A timeout REPORTS rather than
    // throws — one slow scene must cost one 'unstable' row, not the whole run.
    await canvases.first().waitFor({ timeout: 90000 });
  } catch {
    return { canvas: null, reason: 'no canvas appeared within 90s' };
  }
  const count = await canvases.count();
  if (count !== 1) return { canvas: null, reason: `expected exactly 1 canvas, found ${count}` };
  return { canvas: canvases.first(), reason: null };
}

/**
 * The element a capture clips to: the 2D comparison frame when the scene opened
 * in the 2D workspace, the scene canvas otherwise. One call so a caller cannot
 * pick the 2D context and then screenshot the 3D element.
 */
export async function findCaptureTarget(page, { canvas2D = false } = {}) {
  if (canvas2D) {
    const { frame, reason } = await findCanvas2DFrame(page);
    return { target: frame, reason };
  }
  const { canvas, reason } = await findCanvas(page);
  return { target: canvas, reason };
}

/**
 * Screenshot the canvas once it is provably settled: two consecutive
 * byte-identical captures. A scene that never settles is a measurement that
 * cannot be trusted, so it returns a reason rather than whatever frame was up —
 * flakiness is rejected here, not absorbed by tolerance downstream.
 */
export async function settleCanvas(page, canvas, { screenshotTimeout } = {}) {
  // A whole game world under SwiftShader can take longer to rasterise ONE frame
  // than Playwright's default action timeout allows, which surfaces as a
  // screenshot timeout rather than as "never settled". Raising it per scene
  // keeps an ordinary scene's genuine hang from taking that long to report.
  const shot = () => canvas.screenshot(screenshotTimeout ? { timeout: screenshotTimeout } : {});
  await page.waitForTimeout(SETTLE_INITIAL_MS);
  let prev = await shot();
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const cur = await shot();
    if (cur.equals(prev)) return { buffer: cur, reason: null };
    prev = cur;
  }
  return {
    buffer: null,
    reason: `never settled: ${SETTLE_MAX_ATTEMPTS} captures over ${
      SETTLE_MAX_ATTEMPTS * SETTLE_INTERVAL_MS
    }ms all differed`,
  };
}
