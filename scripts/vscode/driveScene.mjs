/**
 * Drives the REAL VS Code with the TextScene extension loaded, over CDP, and
 * reports what the preview webview painted.
 *
 * The extension renders into a webview — a sandboxed `vscode-webview://` iframe
 * the extension host cannot see into. The extension-host integration suite
 * therefore proves only that the panel loads and completes its handshake, never
 * that anything painted. This module closes that gap: it launches the VS Code
 * build `@vscode/test-electron` downloads, attaches Playwright over CDP, opens
 * the preview through the extension's OWN contributed command, walks into the
 * webview frame and counts ink pixels.
 *
 * CDP injection and evaluation are not subject to the page's CSP, which is what
 * lets this instrument a webview whose CSP is `default-src 'none'` without any
 * test-only branch in the rendering code.
 *
 * Two callers: `drive-vscode.mjs` (the CLI, for screenshots and one-off
 * measurements) and `webview-csp-gate.mjs` (the automated regression gate).
 */
/* global document, HTMLCanvasElement, addEventListener */
// Those globals appear only inside `evaluate`/`addInitScript` callbacks, which
// are serialised and run in the browser, never in this Node process.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { inkStats } from './pixels.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EXTENSION_DIR = path.join(REPO_ROOT, 'apps/textscene-vscode');
const VSCODE_TEST_DIR = path.join(EXTENSION_DIR, '.vscode-test');

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Preflight
// ============================================================================

/**
 * The VS Code build a previous `test:integration` run left behind, or `null`.
 * Nothing else in the repo ships a VS Code binary.
 */
function cachedVscodeBinary() {
  if (!existsSync(VSCODE_TEST_DIR)) return null;
  const candidates = readdirSync(VSCODE_TEST_DIR)
    .filter((entry) => entry.startsWith('vscode-'))
    .map((entry) => path.join(VSCODE_TEST_DIR, entry, 'code'))
    .filter((candidate) => existsSync(candidate));
  return candidates.sort().pop() ?? null;
}

/**
 * Resolves a VS Code executable, downloading one if this worktree has never run
 * the integration suite. `cachePath` is the extension's own `.vscode-test`, so
 * the two suites share a single download rather than racing two of them.
 *
 * @param {{ download?: boolean }} [options] `download: false` fails instead of
 *   fetching — the CLI's preflight, which would otherwise stall for minutes on
 *   a typo.
 */
export async function resolveVscodeBinary(options = {}) {
  const cached = cachedVscodeBinary();
  if (cached) return cached;
  if (options.download === false) {
    throw new Error(
      `No VS Code build under ${VSCODE_TEST_DIR}. Run ` +
        `\`pnpm --filter textscene-inspector test:integration\` once — it downloads one.`
    );
  }
  return downloadAndUnzipVSCode({ cachePath: VSCODE_TEST_DIR });
}

/** The built artifacts `--extensionDevelopmentPath` loads. */
export const REQUIRED_BUILD_OUTPUTS = ['dist/extension.js', 'dist/webview/webview.js'];

export function assertExtensionBuilt() {
  for (const built of REQUIRED_BUILD_OUTPUTS) {
    if (!existsSync(path.join(EXTENSION_DIR, built))) {
      throw new Error(
        `Missing ${built}. Run \`pnpm --filter textscene-inspector build\` first.`
      );
    }
  }
}

// ============================================================================
// Launch
// ============================================================================

/**
 * Seeds a throwaway user-data dir. Without these settings a first-run VS Code
 * opens the Welcome tab over the editor and starts talking to the update and
 * telemetry endpoints, which pollutes the offline check.
 */
function seedUserDataDir(extraSettings) {
  const dir = mkdtempSync(path.join(tmpdir(), 'textscene-vscode-drive-'));
  const userDir = path.join(dir, 'User');
  mkdirSync(userDir, { recursive: true });
  writeFileSync(
    path.join(userDir, 'settings.json'),
    JSON.stringify(
      {
        'workbench.startupEditor': 'none',
        'workbench.tips.enabled': false,
        'workbench.enableExperiments': false,
        'update.mode': 'none',
        'update.showReleaseNotes': false,
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'telemetry.telemetryLevel': 'off',
        'window.restoreWindows': 'none',
        'window.newWindowDimensions': 'default',
        'editor.minimap.enabled': false,
        ...extraSettings,
      },
      null,
      2
    )
  );
  return dir;
}

function launchVscode({ binary, scene, workspace, userDataDir, port, headed, verbose }) {
  const codeArgs = [
    `--extensionDevelopmentPath=${EXTENSION_DIR}`,
    // Disables every INSTALLED extension. The one under
    // --extensionDevelopmentPath is still loaded — that is exactly the combo
    // the integration suite uses.
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates',
    '--new-window',
    // The cached build's chrome-sandbox is not setuid, so the namespace
    // sandbox is unavailable; without the GL flags the GPU process fails to
    // bind a command buffer under Xvfb and every WebGL context creation
    // throws ("BindToCurrentSequence failed") — the canvas then stays at its
    // unsized 300x150 default and nothing paints.
    '--no-sandbox',
    '--disable-gpu-sandbox',
    ...SWIFTSHADER_GL_ARGS,
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    workspace,
    scene,
  ];

  const useXvfb = !headed;
  const command = useXvfb ? 'xvfb-run' : binary;
  // 24-bit depth is required for GL; the geometry also sizes the VS Code
  // window and therefore every screenshot. `--server-args=` is ONE argv
  // element — no shell is involved, so the spaces inside it are safe.
  const args = useXvfb
    ? ['-a', '--server-args=-screen 0 1920x1080x24', binary, ...codeArgs]
    : codeArgs;

  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so teardown can take the whole tree (xvfb-run's shell,
    // Xvfb itself, the Electron main process and its renderers) down at once.
    detached: true,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: verbose ? '1' : '' },
  });
  const log = [];
  const capture = (stream, tag) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      log.push(`[${tag}] ${chunk}`);
      if (verbose) process.stderr.write(`[${tag}] ${chunk}`);
    });
  };
  capture(child.stdout, 'code');
  capture(child.stderr, 'code:err');
  return { child, log };
}

/**
 * Tears down the launch. SIGKILL rather than SIGTERM: the Electron main
 * process catches SIGTERM and shuts down slowly under Xvfb, leaving orphaned
 * renderers and an Xvfb server behind. The negative pid targets the whole
 * process group (xvfb-run's shell, its Xvfb, the dev-host and its helpers);
 * the pkill sweep catches any helper that got re-parented out of the group,
 * matched on the absolute user-data-dir so a concurrent run in a sibling
 * worktree — or the developer's own VS Code — is never touched.
 */
async function stopVscode(child, userDataDir) {
  try {
    if (child.pid) process.kill(-child.pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  try {
    execSync(`pkill -9 -f -- ${userDataDir}`, { stdio: 'ignore' });
  } catch {
    /* pkill exits 1 when nothing matched */
  }
  await sleep(500);
}

// ============================================================================
// CDP attach
// ============================================================================

async function waitForCdp(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(400);
  }
  throw new Error(`CDP never came up on port ${port}: ${lastError?.message ?? 'timeout'}`);
}

/**
 * VS Code's renderer serves the workbench from a `vscode-file://` URL. Other
 * targets (shared process, issue reporter) can show up on the same CDP
 * endpoint, so match on the workbench document specifically.
 */
async function findWorkbenchPage(browser, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.url().includes('workbench')) return page;
      }
    }
    await sleep(400);
  }
  throw new Error('No workbench page appeared over CDP');
}

// ============================================================================
// Origin attribution
// ============================================================================

/**
 * Whether a URL belongs to the preview webview rather than the workbench.
 *
 * Webview content is served to a `vscode-webview://` document from VS Code's
 * local resource origin (`<scheme>+<authority>.vscode-resource.vscode-cdn.net`,
 * intercepted by a service worker — despite the hostname, no network is
 * involved). The workbench itself lives on `vscode-file://` and talks to
 * `main.vscode-cdn.net` and the marketplace during startup, so a page-wide
 * count of console errors or failed requests is never zero and cannot be
 * asserted on.
 */
export function isWebviewUrl(url) {
  if (!url) return false;
  return url.startsWith('vscode-webview://') || url.includes('.vscode-resource.vscode-cdn.net');
}

/** Bucket key `requestHosts` uses: the host for http(s), else the scheme. */
function requestBucketKey(url) {
  const scheme = url.split(':')[0];
  return /^https?$/.test(scheme) ? new URL(url).host : scheme;
}

/**
 * Origins the webview may talk to while offline: VS Code's local resource
 * origin, and the non-network schemes the CSP grants (`data:`/`blob:` under
 * `img-src`). Anything else in the webview bucket means the preview reached
 * for the network.
 */
export function isOfflineWebviewOrigin(key) {
  return (
    key.endsWith('.vscode-resource.vscode-cdn.net') ||
    ['data', 'blob', 'file', 'vscode-webview', 'vscode-file'].includes(key)
  );
}

// ============================================================================
// Opening the preview
// ============================================================================

/**
 * Runs a command-palette command by its visible label.
 *
 * The palette is retried: a keystroke sent before the workbench has finished
 * its first layout is swallowed, and the widget also closes itself if the
 * window's focus changes underneath it.
 */
async function palette(page, label) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.keyboard.press('Control+Shift+P');
    try {
      await page.locator('.quick-input-widget').waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      if (attempt === 4) throw new Error(`Command palette never opened (for "${label}")`);
      await sleep(1500);
      continue;
    }
    await page.keyboard.type(label, { delay: 8 });
    await sleep(800); // let the fuzzy filter settle on the top match
    await page.keyboard.press('Enter');
    await sleep(600);
    return;
  }
}

/**
 * Clicks the editor-title "Open Preview to the Side" action the extension
 * contributes for `.tscn` files, falling back to the command palette. Either
 * way the preview is opened by the extension's own contributed command, so the
 * webview and its CSP are the production ones.
 *
 * The title-bar button is preferred because it is a real mouse event on a
 * visible element: the command palette is a quick-input widget that VS Code
 * dismisses when the window loses focus, and a window under a bare Xvfb (no
 * window manager) does not reliably have focus.
 */
async function openPreview(page) {
  const titleAction = page.locator('[aria-label*="Open Preview to the Side"]').first();
  try {
    await titleAction.waitFor({ state: 'visible', timeout: 20_000 });
    await titleAction.click();
    return 'editor-title-action';
  } catch {
    /* fall through to the palette */
  }

  await palette(page, 'TextScene: Open Preview to the Side');
  return 'command-palette';
}

/**
 * Finds the preview's webview frame.
 *
 * VS Code nests webviews two deep — a `vscode-webview://<uuid>/index.html`
 * host frame inside the workbench, and the extension's own content in an
 * `about:blank`-ish child of THAT. Both report a `vscode-webview://` origin,
 * so identify the extension's frame by its DOM (`#r3f-root`) rather than by
 * URL. Frames whose evaluate throws are detached or still navigating.
 */
async function findWebviewFrame(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const hasRoot = await frame
        .evaluate(() => Boolean(document.getElementById('r3f-root')))
        .catch(() => false);
      if (hasRoot) return frame;
    }
    await sleep(400);
  }
  throw new Error('No webview frame carrying #r3f-root appeared');
}

/**
 * Waits for a WebGL canvas that has actually been sized. An unsized 300x150
 * canvas means either the React tree has not laid out yet, or WebGL context
 * creation failed — in both cases anything read back would be a false
 * negative.
 */
async function waitForSizedCanvas(frame, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sized = await frame
      .evaluate(() =>
        [...document.querySelectorAll('canvas')].some(
          (canvas) => canvas.width > 50 && canvas.height > 50
        )
      )
      .catch(() => false);
    if (sized) return true;
    await sleep(400);
  }
  return false;
}

/** Reads the viewport canvas back as a PNG data URL, or an `error:`/`null` marker. */
function readCanvasDataUrl(frame) {
  return frame.evaluate(() => {
    // The viewport canvas is the biggest one: offscreen passes mount their
    // own small canvases in the same document.
    const canvas = [...document.querySelectorAll('canvas')].sort(
      (a, b) => b.width * b.height - a.width * a.height
    )[0];
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      return `error:${String(error)}`;
    }
  });
}

/**
 * Waits until two consecutive canvas readbacks are byte-identical.
 *
 * This is the settle signal a fixed sleep only approximates: resources arrive
 * over the host message channel and the atlas decodes asynchronously, so a read
 * taken too early sees a canvas that has been sized but not yet painted — which
 * scores zero ink and looks exactly like "nothing rendered". Mirrors the
 * two-identical-captures rule the golden-image harness uses.
 *
 * Returns the last data URL and whether it stabilized inside the deadline.
 */
async function stabilizeCanvas(frame, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let current = await readCanvasDataUrl(frame).catch(() => null);
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const previous = current;
    current = await readCanvasDataUrl(frame).catch(() => null);
    if (current && current === previous && current.startsWith(PNG_DATA_URL_PREFIX)) {
      return { dataUrl: current, stable: true };
    }
  }
  return { dataUrl: current, stable: false };
}

// ============================================================================
// Drive
// ============================================================================

/**
 * @typedef {object} DriveSceneOptions
 * @property {string} scene            absolute path to the `.tscn` to preview
 * @property {string} workspace        workspace folder to open
 * @property {string} outDir           where artifacts and `report.json` land
 * @property {string} binary           VS Code executable
 * @property {number} port             CDP port
 * @property {number} settle           extra wait after the canvas stabilizes
 * @property {boolean} preserveBuffer  patch `preserveDrawingBuffer` for readback
 * @property {boolean} prepareLayout   run the layout/notification palette
 *   commands that widen the editor area for a screenshot. The gate leaves this
 *   off: every `palette()` call is a fuzzy match plus Enter, so each one is a
 *   chance to invoke some other command, and the canvas readback does not care
 *   how wide the window is.
 * @property {boolean} split           keep the source editor beside the preview
 * @property {boolean} screenshots     capture workbench/webview PNGs
 * @property {boolean} headed          use the ambient DISPLAY instead of xvfb-run
 * @property {number} keepOpen         hold VS Code open after capture (debugging)
 * @property {string} [evalFile]       ES module whose default export runs in-frame
 * @property {boolean} verbose         stream VS Code stdout/stderr
 * @property {Record<string, unknown>} [settings] extra user settings to seed
 *   the throwaway profile with, for callers that need a layout the palette
 *   commands would otherwise have to click their way to
 * @property {(message: string) => void} [log] progress sink
 */

/** @param {DriveSceneOptions} options */
export async function driveScene(options) {
  const {
    scene,
    workspace,
    outDir,
    binary,
    port,
    settle,
    preserveBuffer,
    prepareLayout,
    split,
    screenshots,
    headed,
    keepOpen,
    evalFile,
    verbose,
    settings,
    log: emit = () => {},
  } = options;

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const userDataDir = seedUserDataDir(settings);
  const report = {
    scene,
    workspace,
    vscodeBinary: binary,
    startedAt: new Date().toISOString(),
    console: [],
    pageErrors: [],
    failedRequests: [],
    cspViolations: [],
    requestHosts: { webview: {}, workbench: {} },
  };

  const { child, log } = launchVscode({ binary, scene, workspace, userDataDir, port, headed, verbose });
  let browser;
  try {
    const version = await waitForCdp(port, 90_000);
    report.browser = version.Browser;
    emit(`CDP up: ${version.Browser}`);

    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const page = await findWorkbenchPage(browser, 60_000);
    emit(`workbench page: ${page.url().slice(0, 80)}…`);
    // Listeners first, so nothing logged during workbench startup is missed.
    page.on('console', (message) => {
      const url = message.location()?.url;
      const entry = {
        type: message.type(),
        text: message.text(),
        url,
        origin: isWebviewUrl(url) ? 'webview' : 'workbench',
      };
      report.console.push(entry);
      if (/Content Security Policy|Refused to/i.test(entry.text)) report.cspViolations.push(entry);
    });
    page.on('pageerror', (error) => report.pageErrors.push(String(error)));
    // Which origins the page talks to, bucketed by the frame that asked. The
    // webview's own bucket is the offline evidence: anything other than
    // `vscode-resource`/`data:` there means the preview reached the network.
    page.on('request', (request) => {
      const frameUrl = request.frame()?.url();
      const bucket = frameUrl?.startsWith('vscode-webview://')
        ? report.requestHosts.webview
        : report.requestHosts.workbench;
      const key = requestBucketKey(request.url());
      bucket[key] = (bucket[key] ?? 0) + 1;
    });
    page.on('requestfailed', (request) => {
      const frameUrl = request.frame()?.url();
      report.failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        frameUrl,
        origin: frameUrl?.startsWith('vscode-webview://') ? 'webview' : 'workbench',
      });
    });

    // The renderer answers CDP well before the workbench has laid itself out;
    // keystrokes sent in that window are swallowed.
    await page.bringToFront().catch(() => {});
    await page.locator('.monaco-workbench').waitFor({ state: 'visible', timeout: 60_000 });
    await sleep(3000);

    // Injected before the webview iframe exists, so it lands in that frame too.
    // CDP injection is not subject to the page's CSP, which is what lets us
    // instrument a webview whose CSP is `default-src 'none'`.
    //   1. `preserveDrawingBuffer` — three.js does not set it, so a WebGL
    //      canvas reads back BLANK from outside the app's own render call.
    //      Forcing it on only preserves what was drawn; it cannot create ink.
    //   2. a `securitypolicyviolation` listener, because a blocked resource
    //      does not always reach the console channel CDP exposes.
    await page.addInitScript((patchBuffer) => {
      if (patchBuffer) {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function patched(type, attributes) {
          if (typeof type === 'string' && type.startsWith('webgl')) {
            return original.call(this, type, {
              ...(attributes ?? {}),
              preserveDrawingBuffer: true,
            });
          }
          return original.call(this, type, attributes);
        };
      }
      globalThis.__textsceneCspViolations = [];
      addEventListener('securitypolicyviolation', (event) => {
        globalThis.__textsceneCspViolations.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          source: event.sourceFile,
        });
        console.error(
          `[csp-violation] ${event.effectiveDirective} blocked ${event.blockedURI}`
        );
      });
    }, preserveBuffer);
    report.preserveDrawingBuffer = preserveBuffer;

    if (prepareLayout) {
      // The Chat/Copilot auxiliary bar is open on a fresh profile and steals ~300px
      // from the editor area. A toggle is only deterministic because the profile
      // IS fresh — it is visible on every first launch.
      await palette(page, 'View: Toggle Secondary Side Bar Visibility');
    }

    report.openedVia = await openPreview(page);
    emit(`preview opened via ${report.openedVia}`);

    let frame = await findWebviewFrame(page, 60_000);
    report.webviewFrameUrl = frame.url();
    report.frameTree = page.frames().map((candidate) => ({
      url: candidate.url().slice(0, 120),
      parent: candidate.parentFrame()?.url().slice(0, 60) ?? null,
    }));
    emit(`webview frame: ${frame.url().slice(0, 80)}…`);

    if (!(await waitForSizedCanvas(frame, 45_000))) {
      // Cold-start race: on the first .tscn of a session the extension can
      // still be activating when the command fires, so the panel opens empty.
      emit('no sized canvas — reopening the preview…');
      report.reopened = true;
      await openPreview(page);
      frame = await findWebviewFrame(page, 30_000);
      if (!(await waitForSizedCanvas(frame, 45_000))) {
        report.sizedCanvas = false;
        throw new Error('Webview never produced a sized canvas (see report.json / workbench.png)');
      }
    }
    report.sizedCanvas = true;

    if (prepareLayout && !split) {
      // Drop the raw .tscn editor so the webview fills the editor area — a
      // half-width canvas makes small text unreadable in the screenshot.
      await palette(page, 'View: Close Editors in Other Groups');
      await waitForSizedCanvas(frame, 20_000);
    }
    if (prepareLayout) {
      // Toasts (git-repository prompts, extension notices) float OVER the
      // webview and land in the screenshot.
      await palette(page, 'Notifications: Clear All Notifications');
    }

    // --- settle -------------------------------------------------------------
    if (preserveBuffer) {
      const settled = await stabilizeCanvas(frame, { timeoutMs: 60_000, intervalMs: 500 });
      report.canvasStable = settled.stable;
      emit(`canvas ${settled.stable ? 'stabilized' : 'NEVER stabilized'}`);
    } else {
      // Without the readback patch there is nothing to compare consecutive
      // reads of — every one comes back blank.
      report.canvasStable = null;
    }
    if (settle > 0) await sleep(settle);
    const dataUrl = await readCanvasDataUrl(frame);

    // --- in-frame evaluation ------------------------------------------------
    report.frameProbe = await frame.evaluate(() => {
      const canvases = [...document.querySelectorAll('canvas')].map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        className: canvas.className,
      }));
      return {
        title: document.title,
        canvases,
        textNodeCount: document.querySelectorAll('[data-testid]').length,
        bodyChildren: document.body.children.length,
        cspViolations: globalThis.__textsceneCspViolations ?? [],
      };
    });
    // The in-frame listener runs INSIDE the preview document, so anything it
    // caught is a violation of the preview's own CSP by definition.
    report.cspViolations.push(
      ...(report.frameProbe.cspViolations ?? []).map((entry) => ({ ...entry, origin: 'webview' }))
    );

    if (dataUrl && dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
      const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
      writeFileSync(path.join(outDir, 'canvas.png'), buffer);
      report.canvasReadback = inkStats(buffer);
    } else {
      report.canvasReadback = { error: dataUrl ?? 'no canvas' };
    }

    // --- screenshots --------------------------------------------------------
    if (screenshots) {
      const workbenchShot = await page.screenshot();
      writeFileSync(path.join(outDir, 'workbench.png'), workbenchShot);
      report.workbenchScreenshot = inkStats(workbenchShot);

      const frameElement = await frame.frameElement();
      const webviewShot = await frameElement.screenshot();
      writeFileSync(path.join(outDir, 'webview.png'), webviewShot);
      report.webviewScreenshot = inkStats(webviewShot);
    }

    // --- optional user evaluation ------------------------------------------
    if (evalFile) {
      const source = await import(path.resolve(evalFile));
      report.evalResult = await frame.evaluate(source.default);
    }

    if (keepOpen > 0) {
      emit(`holding VS Code open for ${keepOpen}ms…`);
      await sleep(keepOpen);
    }
  } catch (error) {
    report.error = String(error?.stack ?? error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.vscodeLogTail = log.slice(-40).join('');
    report.webview = summarizeWebview(report);
    writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    // Close the CDP connection before killing VS Code: Playwright treats a
    // vanished target as a crash and throws over the top of the real error.
    if (browser) await browser.close().catch(() => {});
    await stopVscode(child, userDataDir);
    rmSync(userDataDir, { recursive: true, force: true });
  }

  return report;
}

/**
 * The preview-scoped slice of a report — everything the workbench itself
 * contributes (marketplace lookups, built-in extension warnings, its own CDN)
 * is filtered out, so these counts are the ones a gate can require to be zero.
 */
export function summarizeWebview(report) {
  return {
    cspViolations: report.cspViolations.filter((entry) => entry.origin === 'webview'),
    failedRequests: report.failedRequests.filter((entry) => entry.origin === 'webview'),
    consoleErrors: report.console.filter(
      (entry) => entry.origin === 'webview' && entry.type === 'error'
    ),
    requestHosts: report.requestHosts.webview,
    offendingHosts: Object.keys(report.requestHosts.webview).filter(
      (key) => !isOfflineWebviewOrigin(key)
    ),
  };
}
