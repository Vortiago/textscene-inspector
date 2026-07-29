/**
 * Build-and-serve lifecycle for the previewer, shared by every harness that
 * captures from a real browser: the visual-regression gate (`run.mjs`) and the
 * parity capture (`scripts/godot-ref/capture-ours.mjs`).
 *
 * Extracted rather than duplicated because the hard-won parts here are the
 * failure modes, not the happy path — a stale `dist/`, a foreign server on the
 * port, and an orphaned `vite preview` grandchild each produce a harness that
 * reports success while measuring the wrong thing. A second copy would drift
 * out of those protections silently.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '../..');
const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');

const SKIP_BUILD_VALUES = new Set(['1', 'true', 'yes']);

/**
 * Sources whose edits must reach the bundle. The app bundles `@textscene/core`
 * from its BUILT `dist/`, so a core edit needs core rebuilt AND the app
 * re-bundled — two steps, either of which can be skipped without any error.
 */
const BUNDLED_SOURCE_DIRS = ['packages/textscene-core/src', 'apps/textscene-web/src'];

/**
 * Only files that can actually end up in the bundle count. Tests, comparison
 * sheets and fixtures live inside `src/` but vite never sees them, so treating
 * them as staleness would make the guard cry wolf after a test-only edit — and a
 * guard that fires on work it cannot be measuring is one people learn to bypass.
 */
const BUNDLED_FILE = /\.(ts|tsx|js|jsx|css|json)$/;
const NOT_BUNDLED = /\.(test|spec|contract)\.[jt]sx?$/;

/** Newest mtime of a bundle-reachable file under `dir`, and which file carries it. */
function newestMtime(dir) {
  let newest = 0;
  let newestFile = '';
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!BUNDLED_FILE.test(e.name) || NOT_BUNDLED.test(e.name)) continue;
      const m = statSync(p).mtimeMs;
      if (m > newest) {
        newest = m;
        newestFile = p;
      }
    }
  };
  walk(dir);
  return { newest, newestFile };
}

/**
 * Refuse to capture from a bundle older than the sources it claims to contain.
 *
 * `prebuild` chains core's build into the app's, so the happy path is covered —
 * but a build that no-ops, one skipped via VISUAL_SKIP_BUILD, or a source edited
 * after it all yield a harness that measures the PREVIOUS revision and reports it
 * as fact. That failure is invisible: every scene still passes and a fix under
 * test looks like it changed nothing, which is exactly how it wastes an hour.
 */
export function assertWebBuildFresh() {
  if (!existsSync(WEB_DIST_INDEX)) {
    console.error('[preview] no built dist/ to capture from');
    process.exit(1);
  }
  const builtAt = statSync(WEB_DIST_INDEX).mtimeMs;
  for (const dir of BUNDLED_SOURCE_DIRS) {
    const { newest, newestFile } = newestMtime(join(REPO_ROOT, dir));
    if (newest > builtAt) {
      console.error(
        `[preview] dist/ predates ${relative(REPO_ROOT, newestFile)} — this capture would ` +
          `reflect the PREVIOUS revision, not your change.\n` +
          `[preview] rebuild: pnpm --filter @textscene/core build && ` +
          `pnpm --filter @textscene/web-previewer build`
      );
      process.exit(1);
    }
  }
}

/**
 * Build the previewer every run. Reusing an existing `dist/` is how this
 * harness silently captured a build that predated the change under test —
 * every scene "passed" against stale code, and a newly added fixture was
 * missing from the bundle entirely, so its deep link fell back and baked a
 * bogus baseline. A stale-green visual suite is worse than a slow one; set
 * VISUAL_SKIP_BUILD=1 to reuse `dist/` while iterating locally.
 */
export function ensureWebBuilt(log = console.log) {
  const skip = process.env.VISUAL_SKIP_BUILD;
  if (skip !== undefined && !SKIP_BUILD_VALUES.has(skip.trim().toLowerCase())) {
    console.warn(`[preview] VISUAL_SKIP_BUILD="${skip}" not recognised — building anyway`);
  } else if (skip !== undefined && existsSync(WEB_DIST_INDEX)) {
    log('[preview] VISUAL_SKIP_BUILD set — reusing existing dist/');
    // Opting out of the BUILD is fine; opting out of measuring the right
    // revision is not, so the freshness check still runs.
    assertWebBuildFresh();
    return;
  }
  log('[preview] building web previewer…');
  const r = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[preview] web previewer build failed');
    process.exit(1);
  }
  // A build that exits 0 has not necessarily produced a bundle carrying the
  // sources — an incremental step can no-op. Verify rather than assume.
  assertWebBuildFresh();
}

/**
 * Refuse to silently capture from someone else's process. `--strictPort`
 * makes our own preview spawn fail on an occupied port, but that spawn runs
 * detached (`stdio: 'ignore'`) and `waitForServer` below only polls for *a*
 * 200 response — so without this check, an already-listening server (a
 * leftover from a previous run, or a concurrent worktree on the same host
 * also running a harness against the shared default port) would answer
 * instead, and every capture would silently reflect a foreign build.
 *
 * (This is also why `killPreviewGroup` below kills the whole process GROUP,
 * not just its direct child — a `shell: true` spawn's immediate child is the
 * shell, not the `pnpm`→`vite preview` grandchild that actually holds the
 * port; killing only the shell can leave that grandchild running as an
 * orphan, which is exactly the kind of leftover this check guards against.)
 */
export async function assertPortFree(port, envVarName = 'VISUAL_PORT') {
  const free = await new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
  if (!free) {
    console.error(
      `\n[preview] port ${port} is already in use by another process — refusing to capture ` +
        `against an unverified server (it may be a leftover preview from a previous run, or a ` +
        `concurrent worktree on this host also running a capture harness). Free the port, or ` +
        `set ${envVarName}=<free-port> to use a different one.\n`
    );
    process.exit(1);
  }
}

export function startPreview(port) {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(port), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
  return { proc, baseUrl: `http://localhost:${port}` };
}

/**
 * Kill the whole `proc` process GROUP (negative pid), not just `proc` itself.
 * `proc` is a `shell: true` spawn's immediate child — the shell — not the
 * `pnpm`→`vite preview` grandchild that actually binds the port. `detached:
 * true` above makes `proc` its own process-group leader, so its descendants
 * share its pgid and `-proc.pid` reaches all of them in one signal. Killing
 * only `proc.pid` reliably kills the shell but can leave the grandchild
 * running as an orphaned server — which then holds this script's event loop
 * open indefinitely even after all real work is done, since nothing else is
 * scheduled to keep it alive except that leftover handle. Swallow ESRCH: the
 * group may already be gone.
 */
export function killPreviewGroup(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    /* already exited */
  }
}

export async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server at ${url} not ready in ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Capture layer
//
// Everything below encodes an app contract rather than a browser mechanic: the
// localStorage keys the shell reads, the toolbar's testid, and CameraFit's
// load-time timers. A second copy of these does not fail when the app changes —
// it silently measures the wrong pixels (the toolbar composited into a probe,
// or a frame captured before the camera settled), which is the worst failure a
// parity tool can have. Both harnesses share them for that reason.
// ---------------------------------------------------------------------------

/* global document, window */ // the addInitScript callbacks run in the browser.

/** `tscn-web-source-pane` in apps/textscene-web/src/r3f-main.tsx. */
const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';
/** `FRAME_ON_OPEN_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx. */
const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';
/**
 * `FIT_ON_OPEN_2D_STORAGE_KEY` in r3f/components/Canvas2DStage/viewport2d.ts.
 * Exported so a test can pin it to that one: a key that stops matching leaves
 * the stage fitting the scene again, which still captures a picture — just not
 * the one the Godot frame can be compared with.
 */
export const FIT_ON_OPEN_2D_STORAGE_KEY = 'tsi.fitOnOpen2D';

export const VIEWPORT = { width: 1280, height: 800 };

/**
 * The 2D capture frame: Godot's project viewport (`CANVAS_2D_WIDTH/HEIGHT` in
 * `viewport2d.ts`), which is the rectangle the previewer's 2D stage draws and
 * the one a Control resolves its anchors against. Both sides render it 1:1 —
 * the Godot harness through a SubViewport of this size, ours by clipping the
 * stage's frame at zoom 1 — so a 2D pair compares pixel for pixel.
 *
 * `clearColor` is Godot's `rendering/environment/defaults/default_clear_color`
 * default, and `background` is what it MEASURES as in a 2D render (2D composites
 * in sRGB, so the 0.3 lands as byte 76 with no transfer applied). Our stage
 * paints its own editor background, so the capture flattens it to that same
 * grey — otherwise every transparent pixel of the scene would differ.
 *
 * `viewport` is the browser viewport a 2D capture needs: the frame must fit
 * INSIDE the stage at zoom 1, and the stage is what remains of the window after
 * the shell's dock (325px) and top bar (44px).
 */
export const CANVAS_2D_CAPTURE = {
  width: 1152,
  height: 648,
  clearColor: [0.3, 0.3, 0.3],
  background: '#4c4c4c',
  viewport: { width: 1600, height: 900 },
};

/** The 2D stage's chrome, painted out for a capture (see `createCaptureContext`). */
export const CANVAS_2D_TESTIDS = {
  stage: 'canvas-2d-stage',
  frame: 'canvas-2d-frame',
  captureFrame: 'canvas-2d-capture-frame',
  hint: 'canvas-2d-hint',
  zoom: 'canvas-2d-zoom',
  originAxisX: 'origin-axis-x',
  originAxisY: 'origin-axis-y',
};

/**
 * The size of the canvas ELEMENT inside that viewport, once the shell's chrome
 * has taken its share — i.e. the size `canvas.screenshot()` returns.
 *
 * Measured, not derived: it falls out of the app's CSS layout. It lives here so
 * the Godot harness can default to the same frame, which is what makes a probe
 * at (x, y) address the same surface point on both sides with no arguments.
 * Changing VIEWPORT above means re-measuring this.
 */
export const CANVAS_CAPTURE = { width: 955, height: 756 };
export const NETWORK_IDLE_MS = 20000; // ceiling for the app's own resource chain to go quiet
export const SETTLE_INITIAL_MS = 1200; // covers the last CameraFit reframe at 1100 ms
export const SETTLE_INTERVAL_MS = 350;
export const SETTLE_MAX_ATTEMPTS = 12;

/**
 * A browser context scoped to rendering only the scene: source pane closed,
 * viewport toolbar painted out (it floats over the canvas, and
 * `canvas.screenshot()` composites any DOM over the canvas box), and
 * frame-on-open set explicitly rather than inherited from a default a future
 * change could flip.
 *
 * `canvas2D` prepares the 2D stage the same way for the 2D comparison frame:
 * its chrome (grid, viewport outline and dimension label, origin axes, the
 * pan/zoom hint, the zoom HUD) painted out, its background flattened to what
 * Godot clears a 2D viewport to, and its opening view pinned to zoom 1 at the
 * origin instead of "Fit" — so the frame is the game frame at 1:1 and sits at
 * the same integer pixels every run. It is OPT-IN because the golden gate
 * captures 2D scenes WITH that chrome; turning any of it on unconditionally
 * would move those baselines.
 */
export async function createCaptureContext(browser, { frameOnOpen, canvas2D = false }) {
  const context = await browser.newContext({
    viewport: canvas2D ? CANVAS_2D_CAPTURE.viewport : VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible: false, width: 320 })]
  );
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [FRAME_ON_OPEN_STORAGE_KEY, frameOnOpen ? 'true' : 'false']
  );
  if (canvas2D) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [FIT_ON_OPEN_2D_STORAGE_KEY, 'false']
    );
  }
  const hidden = ['viewport-toolbar-overlay'];
  let css = '';
  if (canvas2D) {
    hidden.push(
      CANVAS_2D_TESTIDS.frame,
      CANVAS_2D_TESTIDS.hint,
      CANVAS_2D_TESTIDS.zoom,
      CANVAS_2D_TESTIDS.originAxisX,
      CANVAS_2D_TESTIDS.originAxisY
    );
    css +=
      `[data-testid="${CANVAS_2D_TESTIDS.stage}"]{background-image:none !important;` +
      `background-color:${CANVAS_2D_CAPTURE.background} !important}`;
  }
  css += `${hidden.map((id) => `[data-testid="${id}"]`).join(',')}{display:none !important}`;
  // The <style> must land in <head> once it exists — appending at
  // document-start puts it in an invalid position the parser drops.
  await context.addInitScript((rules) => {
    const add = () => {
      const style = document.createElement('style');
      style.textContent = rules;
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  }, css);
  return context;
}

/** Which workspace the app itself opened the scene in — its own decision, asked, not re-derived. */
export async function readViewportMode(page) {
  const stage = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.stage}"]`);
  return (await stage.count()) > 0 ? '2d' : '3d';
}

/**
 * The 2D comparison frame: the project-viewport rectangle inside the stage, or
 * a reason it cannot be captured. Checked rather than assumed, because every
 * way this goes wrong produces an image that still looks plausible — a stage
 * too small to hold the frame at zoom 1 clips it (the shell's chrome creeps in
 * at the edges), and a fractional origin resamples every pixel of the scene
 * against a reference that was rendered on the integer grid.
 */
export async function findCanvas2DFrame(page) {
  const stage = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.stage}"]`);
  const frame = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.captureFrame}"]`);
  try {
    await frame.waitFor({ timeout: 30000 });
  } catch {
    return { frame: null, reason: 'the 2D stage never mounted — the app opened this scene in 3D' };
  }
  const box = await frame.boundingBox();
  const stageBox = await stage.boundingBox();
  if (!box || !stageBox) return { frame: null, reason: '2D stage frame has no layout box' };
  const { width, height } = CANVAS_2D_CAPTURE;
  if (box.width !== width || box.height !== height) {
    return {
      frame: null,
      reason: `2D frame is ${box.width}x${box.height}, expected ${width}x${height} (zoom is not 1)`,
    };
  }
  if (!Number.isInteger(box.x) || !Number.isInteger(box.y)) {
    return { frame: null, reason: `2D frame origin ${box.x},${box.y} is not on a whole pixel` };
  }
  if (
    box.x < stageBox.x ||
    box.y < stageBox.y ||
    box.x + box.width > stageBox.x + stageBox.width ||
    box.y + box.height > stageBox.y + stageBox.height
  ) {
    return {
      frame: null,
      reason:
        `2D frame ${width}x${height} does not fit the ` +
        `${stageBox.width}x${stageBox.height} stage — widen the capture viewport`,
    };
  }
  return { frame, reason: null };
}

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
  await canvases.first().waitFor({ timeout: 30000 });
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
