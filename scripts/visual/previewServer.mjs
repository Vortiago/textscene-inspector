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
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '../..');
const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');

const SKIP_BUILD_VALUES = new Set(['1', 'true', 'yes']);

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
    log('[preview] VISUAL_SKIP_BUILD set — reusing existing dist/ (may be stale)');
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

export const VIEWPORT = { width: 1280, height: 800 };

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
 */
export async function createCaptureContext(browser, { frameOnOpen }) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible: false, width: 320 })]
  );
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [FRAME_ON_OPEN_STORAGE_KEY, frameOnOpen ? 'true' : 'false']
  );
  // The <style> must land in <head> once it exists — appending at
  // document-start puts it in an invalid position the parser drops.
  await context.addInitScript(() => {
    const add = () => {
      const style = document.createElement('style');
      style.textContent = '[data-testid="viewport-toolbar-overlay"]{display:none !important}';
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
  return context;
}

/**
 * Navigate to a fixture and wait for the app's OWN resource chain to go quiet.
 * `load` fires well before that chain finishes — a scene fetches its .tscn,
 * then an ArrayMesh .tres, then that surface's material, then the material's
 * texture, each only discoverable once the previous one parsed. Without this
 * the settle gate below happily finds two identical frames of the untextured
 * placeholder. A scene that never idles still falls through to the gate.
 */
export async function gotoFixture(page, baseUrl, fixture, onSlow = () => {}) {
  await page.goto(`${baseUrl}/?fixture=${encodeURIComponent(fixture)}`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch((err) => {
    // Anything that is NOT a timeout (crashed target, closed page) is a real
    // failure and must not be mistaken for one.
    if (err?.name !== 'TimeoutError') throw err;
    onSlow(NETWORK_IDLE_MS);
  });
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
 * Screenshot the canvas once it is provably settled: two consecutive
 * byte-identical captures. A scene that never settles is a measurement that
 * cannot be trusted, so it returns a reason rather than whatever frame was up —
 * flakiness is rejected here, not absorbed by tolerance downstream.
 */
export async function settleCanvas(page, canvas) {
  await page.waitForTimeout(SETTLE_INITIAL_MS);
  let prev = await canvas.screenshot();
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const cur = await canvas.screenshot();
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
