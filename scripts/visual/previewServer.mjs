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
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

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

/** Core's own source→emit pair. The app bundles the EMIT, so this pair is checked separately. */
const CORE_SRC_DIR = 'packages/textscene-core/src';
const CORE_DIST_DIR = 'packages/textscene-core/dist';

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
  // Core's OWN dist first, because the app bundles that rather than core's
  // sources: `tsc --build` consults `tsconfig.tsbuildinfo` and will exit 0
  // having emitted NOTHING when that file says everything is current — true
  // even with `dist/` deleted. The app then re-bundles the stale core, rewrites
  // `index.html`, and the source-vs-index check below passes on a bundle that
  // does not contain the change under test. Comparing against index.html alone
  // cannot see this: the freshly written index is exactly what makes it look
  // fine.
  const coreSrc = newestMtime(join(REPO_ROOT, CORE_SRC_DIR));
  const coreDist = newestMtime(join(REPO_ROOT, CORE_DIST_DIR));
  if (coreSrc.newest > coreDist.newest) {
    console.error(
      `[preview] ${CORE_DIST_DIR} predates ${relative(REPO_ROOT, coreSrc.newestFile)} — the app ` +
        `would bundle a stale core and every scene would "pass" against the PREVIOUS revision.\n` +
        `[preview] tsc kept a stale emit; clear its incremental state and rebuild:\n` +
        `[preview]   find packages apps -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete\n` +
        `[preview]   pnpm --filter @textscene/core build`
    );
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

/**
 * Reap the preview group when THIS process ends, however it ends.
 *
 * `detached: true` is what lets one signal reach the whole
 * `shell`→`pnpm`→`vite preview` group; it is equally what lets that group
 * outlive us. Every harness already calls `killPreviewGroup` from a `finally`,
 * but Node runs no `finally` when the process is signalled — so an interrupted
 * run (Ctrl-C, a CI step timing out, a supervisor's SIGTERM) leaves a server
 * holding its port with nothing left that knows about it. `assertPortFree`
 * above DETECTS that leftover on the next run; this prevents making one.
 *
 * Registered at the spawn rather than in each caller, so a new harness cannot
 * acquire the leak by forgetting to opt in.
 *
 * `exit` covers normal and thrown termination, and must stay synchronous —
 * `process.kill` is. The signal handlers reap and then re-raise, which reaches
 * the default disposition now that `once` has removed the listener, so the
 * harness still dies of the signal it was sent instead of reporting a clean
 * exit. SIGKILL cannot be caught and stays the one path that orphans a server.
 */
export function registerPreviewGroupTeardown(proc) {
  const onExit = () => killPreviewGroup(proc);
  const onSignal = (signal) => {
    process.removeListener('exit', onExit);
    killPreviewGroup(proc);
    process.kill(process.pid, signal);
  };
  process.once('exit', onExit);
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGHUP', () => onSignal('SIGHUP'));
}

export function startPreview(port) {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(port), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
  registerPreviewGroupTeardown(proc);
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
/**
 * `VIEWPORT_MODE_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx — the
 * user's own workspace preference, which `WorkspaceAutoSelect` overrides only
 * when the scene ROOT claims a workspace. A `Node`-rooted 2D scene
 * (`game_splitscreen.tscn`: Node → ColorRect → SubViewportContainers) claims
 * neither, exactly as in Godot's editor, so without this a 2D capture of one
 * opens in the 3D workspace and finds no stage to shoot.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';

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

/**
 * THE SETTLE CONTRACT — the simulated moment in the scene's own clock at which
 * BOTH harnesses open the shutter, in seconds. Defined once, here, and read by
 * the Godot side (`scripts/godot-ref/run.mjs`) and by our side below.
 *
 * Two things get called "settling" in these harnesses and they are NOT the same
 * knob:
 *
 *  - CONVERGENCE — how many frames until the picture stops changing (a texture
 *    import lands, the first draw completes, shaped text finally measures).
 *    This is allowed to differ per side and does: Godot steps a fixed count of
 *    process frames, we take screenshots until two are byte-identical. It is a
 *    stopping test with no semantic content, so no shared number is meaningful.
 *  - THIS — where the scene's simulated clock sits when the picture is taken.
 *    It carries all the meaning. Two sides that converge cleanly but sample
 *    different instants produce an apples-to-oranges measurement even though
 *    each side is individually deterministic, and nothing in either harness
 *    fails.
 *
 * Zero is not a placeholder, it is the contract: the previewer runs no
 * simulated clock at all. The animation transport starts stopped (ADR-0011 /
 * ADR-0012), there is no physics and no GDScript, and nothing in the render
 * path reads a wall clock. So the only simulated instant our side can be
 * asked for is its load instant, and the reference harness matches it by
 * pausing the SceneTree before the scene is ever instantiated.
 *
 * Raising this needs work on BOTH sides that does not exist yet: Godot would
 * have to advance the window under `--fixed-fps` (its delta is wall-clock
 * otherwise), and the previewer would have to grow a driveable global
 * elapsed-time hook. Both harnesses therefore REFUSE a non-zero value rather
 * than each interpreting it their own way — a silent divergence here is
 * invisible in every image it corrupts.
 */
export const SETTLE_SIM_SECONDS = 0;

// Convergence knobs — how long our side waits for the picture to stop moving.
// Deliberately unrelated to SETTLE_SIM_SECONDS above; see its doc.
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
 * zoom HUD) painted out, its background flattened to what
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
    // Seeds the preference the shell reads once at mount. A scene whose root
    // DOES claim a workspace still wins here (WorkspaceAutoSelect applies its
    // claim after), so a Node3D-rooted scene captured with --2d still reports
    // the mismatch rather than silently shooting the wrong frame.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [VIEWPORT_MODE_STORAGE_KEY, JSON.stringify('2D')]
    );
  }
  // Viewport chrome that floats over the canvas in BOTH modes, and so would
  // composite into every capture the way the toolbar overlay does.
  const hidden = ['viewport-toolbar-overlay', 'viewport-controls-help'];
  let css = '';
  if (canvas2D) {
    hidden.push(
      CANVAS_2D_TESTIDS.frame,
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

/**
 * Set one of the viewport's display toggles, driving the real UI.
 *
 * App-structure knowledge lives here rather than at the call site for the
 * reason this module exists: a second copy does not fail when the app changes,
 * it silently measures the wrong pixels. The toggles moved behind a menu once
 * already.
 *
 * ATTACHED, not visible, and `dispatchEvent` rather than `click()`: the capture
 * context paints the whole toolbar overlay out with `display: none` so it
 * cannot composite into `canvas.screenshot()`. The controls are fully
 * functional, just unpainted, and Playwright refuses to click a hidden target.
 *
 * Returns null on success, or a reason string for the caller to fail with.
 */
export async function setDisplayToggle(page, label, wanted) {
  const popover = page.locator('[data-testid="display-menu-popover"]');
  // Idempotent: a scene may ask for two toggles, and a second click would shut
  // the menu again.
  if ((await popover.count()) === 0) {
    const button = page.locator('[data-testid="display-menu-button"]');
    try {
      await button.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      return 'Display menu button not found in the toolbar';
    }
    await button.dispatchEvent('click');
    await popover.waitFor({ state: 'attached', timeout: 10000 });
  }
  // By testid, so a re-layout fails loudly on a missing node instead of
  // quietly substring-matching a different label.
  const toggle = page.locator(`[data-testid="display-toggle-${label}"]`);
  try {
    await toggle.waitFor({ state: 'attached', timeout: 10000 });
  } catch {
    return `${label} toggle not found in the Display menu`;
  }
  if ((await toggle.isChecked()) !== wanted) await toggle.dispatchEvent('click');
  return null;
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
  // What the frame IS, from the stage itself, rather than a constant here: the
  // rect is the scene's `display/window/size/viewport_*`, so 23 of the corpus's
  // projects are not 1152x648. The invariant this guards is still zoom 1 — the
  // frame's laid-out box must equal its own declared size.
  const declared = await frame.getAttribute('data-viewport-size');
  const [width, height] = (declared ?? '').split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      frame: null,
      reason: `2D frame declares no usable viewport size (data-viewport-size=${declared})`,
    };
  }
  // Zoom 1 is the goal, not the rule. Godot's own 2D editor zooms to fit a
  // project rect larger than the window, and `games/godot-open-rts` is
  // 1920x1080 against a stage of about 950x750 — so a fixed zoom-1 assumption
  // is OURS, not Godot's, and would report a working capture as broken. What
  // must hold is that the frame is the project's rect at a UNIFORM scale: both
  // axes at the same factor, and never magnified (which would resample the
  // scene up and compare it against a reference rendered at 1:1).
  const scale = box.width / width;
  if (scale > 1.001 || Math.abs(box.height / height - scale) > 0.002) {
    return {
      frame: null,
      reason:
        `2D frame is ${box.width}x${box.height} for a ${width}x${height} viewport — ` +
        'not the project rect at a uniform scale of 1 or less',
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
 *
 * Two identical frames is a CONVERGENCE test, not a clock reading: it proves
 * the picture stopped moving, which for a side that runs no simulated clock is
 * the same thing as standing at `SETTLE_SIM_SECONDS` = 0, and for any other
 * value proves nothing at all. So the contract is asserted rather than assumed
 * — the alternative is this side quietly sampling its load instant while the
 * reference samples a later one, which corrupts every measurement made from
 * the pair and shows up in none of them.
 */
export async function settleCanvas(
  page,
  canvas,
  { screenshotTimeout, simSeconds = SETTLE_SIM_SECONDS } = {}
) {
  if (simSeconds !== 0) {
    throw new Error(
      `settle contract asks for ${simSeconds}s of simulated time, and this side cannot reach ` +
        'it: the previewer runs no global clock (the animation transport starts stopped, ' +
        'nothing steps physics or GDScript) and settling is a convergence test, not a seek. ' +
        'Reaching a non-zero settle needs a driveable elapsed-time hook in the renderer first.'
    );
  }
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

/**
 * A throwaway WebGL context, created and torn down before any real scene is
 * captured.
 *
 * The first WebGL context in a fresh headless Chromium+SwiftShader process
 * can lose context under load before a screenshot lands — and `settleCanvas`
 * cannot tell a lost context from a settled one: two captures of a dead,
 * uniform canvas are exactly as byte-identical as two captures of a
 * genuinely stable frame, so the settle gate is silently defeated rather than
 * failed. Whichever scene captures first in a fresh process absorbs that
 * risk; this burns the risk here instead, on a page nothing depends on,
 * before the real capture pages ever open.
 */
export async function warmUpGLContext(browser) {
  const context = await browser.newContext({ viewport: { width: 64, height: 64 } });
  try {
    const page = await context.newPage();
    await page.setContent(
      '<canvas id="warmup" width="64" height="64"></canvas><script>' +
        'const gl = document.getElementById("warmup").getContext("webgl2") || ' +
        'document.getElementById("warmup").getContext("webgl"); ' +
        'if (gl) { for (let i = 0; i < 60; i++) { ' +
        'gl.clearColor(Math.random(), Math.random(), Math.random(), 1); ' +
        'gl.clear(gl.COLOR_BUFFER_BIT); gl.finish(); } }' +
        '</script>'
    );
    await page.waitForTimeout(500);
  } finally {
    await context.close();
  }
}

/**
 * A fully uniform image is never a legitimate capture — it is either a WebGL
 * context that died mid-capture (readback comes back all-black or all one
 * clear colour) or a scene that rendered nothing. Two captures of that dead
 * frame are byte-identical, so `settleCanvas` reports it as settled.
 */
export function isUniformImage(buffer) {
  const { data } = PNG.sync.read(buffer);
  const [r0, g0, b0, a0] = data;
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0 || data[i + 3] !== a0) {
      return false;
    }
  }
  return true;
}

/**
 * The only sanctioned way to commit a capture to disk.
 *
 * The distinction between a settled frame and a dead one survives exactly this
 * far and no further: a comparing harness catches a blank frame for free
 * (it diffs hugely and fails), while a WRITING one publishes it and disables
 * itself permanently — every later comparison then passes against a blank
 * reference no matter how badly the renderer breaks. Refusing costs a re-run;
 * accepting costs the guard.
 *
 * A node that genuinely draws nothing is not this case: its sheet declares
 * `visual: false`, which keeps it out of the capture set entirely.
 */
export function writeCaptureImage(path, buffer, what) {
  if (isUniformImage(buffer)) {
    throw new Error(
      `${what}: capture is a single uniform colour throughout — refusing to write it ` +
        `to ${path}. That is a lost WebGL context or an unrendered scene, never a real ` +
        'capture; a node that draws nothing belongs on a `visual: false` sheet.'
    );
  }
  writeFileSync(path, buffer);
}
