/**
 * Drives the real VS Code with the TextScene extension loaded, over CDP, and
 * reports what the preview webview painted. Two callers: `drive-vscode.mjs`,
 * the CLI, and `webview-csp-gate.mjs`, the automated gate.
 */
/* global document, addEventListener */
// Those globals appear only inside `evaluate`/`addInitScript` callbacks, which
// are serialised and run in the browser, never in this Node process.
import { execSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { inkStats } from './pixels.mjs';
import { THROWAWAY_USER_SETTINGS } from './userSettings.mjs';
import { isSizedCanvas } from './canvasSize.mjs';
import { CAPTURE_STATE_OF_MESSAGE, installCaptureStateProbe, waitForCaptureReady } from './captureState.mjs';
import { isRefusedAttachCall, startCdpRelay } from './cdpRelay.mjs';
import {
  VSCODE_VERSION_ENV,
  vscodeTestVersion,
} from '../../apps/textscene-vscode/src/test/integration/integrationLaunch.ts';
import {
  preserveWebglDrawingBuffer,
  readCanvasDataUrl,
  sleep,
  stabilizeCanvas,
  waitForCanvasChange,
  writeCanvasPng,
} from './canvasReadback.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EXTENSION_DIR = path.join(REPO_ROOT, 'apps/textscene-vscode');
const VSCODE_TEST_DIR = path.join(EXTENSION_DIR, '.vscode-test');

export { sleep };

/**
 * How long a canvas may take to settle, polled at an interval long enough for a
 * resource to arrive over the host channel between two readbacks.
 */
const SETTLE_POLL = { timeoutMs: 60_000, intervalMs: 500 };

/** How long a watched edit may take to reach the canvas: the watcher, the host and a reload. */
const EDIT_POLL = { timeoutMs: 30_000, intervalMs: 250 };

/**
 * The VS Code build `TEXTSCENE_VSCODE_VERSION` asks for, resolved as the extension's
 * own suites resolve it: `stable` when unset, the `engines.vscode` floor for `min`.
 */
function requestedVscodeVersion() {
  const manifest = JSON.parse(readFileSync(path.join(EXTENSION_DIR, 'package.json'), 'utf8'));
  return vscodeTestVersion(process.env[VSCODE_VERSION_ENV], manifest.engines.vscode);
}

/** Orders `1.85.0` before `1.140.0`, which a string sort reverses. */
function compareVersions(a, b) {
  const [pa, pb] = [a, b].map((version) => version.split('.').map(Number));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const order = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (order !== 0) return order;
  }
  return 0;
}

/**
 * Picks from the cached build directories (`vscode-linux-x64-1.85.0`) the one for
 * `version`: that exact build, or the newest for `stable`. `null` when none fits.
 *
 * @param {string[]} entries directory names under `.vscode-test`
 * @param {string} version an exact version or `stable`
 */
export function pickCachedBuild(entries, version) {
  const builds = entries
    .map((entry) => ({ entry, version: /^vscode-.+-(\d+\.\d+\.\d+)$/.exec(entry)?.[1] }))
    .filter((build) => build.version);
  if (version !== 'stable') return builds.find((build) => build.version === version)?.entry ?? null;
  return builds.sort((a, b) => compareVersions(a.version, b.version)).pop()?.entry ?? null;
}

/**
 * The cached build of `version` a previous `test:integration` run left behind, or
 * `null`. Nothing else in the repo ships a VS Code binary.
 */
function cachedVscodeBinary(version) {
  if (!existsSync(VSCODE_TEST_DIR)) return null;
  const entries = readdirSync(VSCODE_TEST_DIR).filter((entry) =>
    existsSync(path.join(VSCODE_TEST_DIR, entry, 'code'))
  );
  const build = pickCachedBuild(entries, version);
  return build && path.join(VSCODE_TEST_DIR, build, 'code');
}

/**
 * Resolves the VS Code executable `requestedVscodeVersion` names, downloading it if
 * this worktree has none. `cachePath` is the extension's own `.vscode-test`, so the
 * two suites share a single download rather than racing two of them.
 *
 * @param {{ download?: boolean }} [options] `download: false` takes the cached build
 *   and fails when there is none, so the CLI does not stall for minutes on a typo.
 */
export async function resolveVscodeBinary(options = {}) {
  const version = requestedVscodeVersion();
  if (options.download === false) {
    const cached = cachedVscodeBinary(version);
    if (cached) return cached;
    throw new Error(
      `No VS Code ${version} build under ${VSCODE_TEST_DIR}. Run ` +
        `\`pnpm --filter textscene-inspector test:integration\` once with the same ` +
        `${VSCODE_VERSION_ENV}: it downloads one.`
    );
  }
  // A cached build answers at once. For `stable` the library first asks which build
  // is current, so a new release replaces a stale cache.
  return downloadAndUnzipVSCode({ version, cachePath: VSCODE_TEST_DIR });
}

/** The built artifacts `--extensionDevelopmentPath` loads. */
export const REQUIRED_BUILD_OUTPUTS = ['dist/extension.js', 'dist/webview/webview.js'];

export function assertExtensionBuilt() {
  for (const built of REQUIRED_BUILD_OUTPUTS) {
    if (!existsSync(path.join(EXTENSION_DIR, built))) {
      throw new Error(`Missing ${built}. Run \`pnpm --filter textscene-inspector build\` first.`);
    }
  }
}

/** Seeds a throwaway user-data dir with the shared first-run settings. */
function seedUserDataDir(extraSettings) {
  const dir = mkdtempSync(path.join(tmpdir(), 'textscene-vscode-drive-'));
  const userDir = path.join(dir, 'User');
  mkdirSync(userDir, { recursive: true });
  writeFileSync(
    path.join(userDir, 'settings.json'),
    JSON.stringify({ ...THROWAWAY_USER_SETTINGS, ...extraSettings }, null, 2)
  );
  return dir;
}

function launchVscode({ binary, scene, workspace, userDataDir, port, headed, verbose }) {
  const codeArgs = [
    `--extensionDevelopmentPath=${EXTENSION_DIR}`,
    // Disables every installed extension. The one under
    // --extensionDevelopmentPath still loads, as in the integration suite.
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates',
    '--new-window',
    // The cached build's chrome-sandbox is not setuid, so the namespace
    // sandbox is unavailable.
    '--no-sandbox',
    '--disable-gpu-sandbox',
    // Without the GL flags the GPU process under Xvfb cannot bind a command
    // buffer, every WebGL context throws ("BindToCurrentSequence failed"), and
    // the canvas stays at its unsized 300x150 default.
    ...SWIFTSHADER_GL_ARGS,
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    workspace,
    scene,
  ];

  const useXvfb = !headed;
  const command = useXvfb ? 'xvfb-run' : binary;
  // GL needs 24-bit depth. The geometry also sizes the VS Code window and every
  // screenshot. `--server-args=` is one argv element with no shell, so its
  // spaces are safe.
  const args = useXvfb ? ['-a', '--server-args=-screen 0 1920x1080x24', binary, ...codeArgs] : codeArgs;

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
 * Tears down the launch. SIGKILL, not SIGTERM: the Electron main process
 * catches SIGTERM and shuts down slowly under Xvfb, leaving orphaned renderers
 * and an Xvfb server behind.
 */
async function stopVscode(child, userDataDir) {
  try {
    // The negative pid targets the whole process group: xvfb-run's shell, its
    // Xvfb, the dev host and its helpers.
    if (child.pid) process.kill(-child.pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  // Catches a helper re-parented out of the group. It matches the absolute
  // user-data dir, so a run in a sibling worktree, or the developer's own
  // VS Code, is never touched.
  try {
    execSync(`pkill -9 -f -- ${userDataDir}`, { stdio: 'ignore' });
  } catch {
    /* pkill exits 1 when nothing matched */
  }
  await sleep(500);
}

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
 * Attaches Playwright to the CDP endpoint on `port`. A build that refuses one of
 * Playwright's attach calls, as VS Code 1.85 does, is attached through a relay
 * that answers the call, so the driver also measures the `engines.vscode` floor.
 */
async function connectOverCdp(port, emit) {
  try {
    return { browser: await chromium.connectOverCDP(`http://127.0.0.1:${port}`) };
  } catch (error) {
    if (!isRefusedAttachCall(error)) throw error;
  }
  const relay = await startCdpRelay(port);
  emit(`CDP attach refused a call, so attaching through a relay on port ${relay.port}`);
  try {
    return { browser: await chromium.connectOverCDP(`http://127.0.0.1:${relay.port}`), relay };
  } catch (error) {
    await relay.close();
    throw error;
  }
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

/** VS Code's local resource origin, as the last labels of a webview resource's hostname. */
const LOCAL_RESOURCE_HOST_SUFFIX = '.vscode-resource.vscode-cdn.net';

/**
 * Whether a URL belongs to the preview webview rather than the workbench.
 * Webview frames load from the `vscode-webview:` scheme, and their content from
 * VS Code's local resource origin (`<scheme>+<authority>.vscode-resource.vscode-cdn.net`),
 * which a service worker intercepts, so despite the hostname no network is involved.
 */
export function isWebviewUrl(url) {
  if (!URL.canParse(url)) return false;
  const { protocol, hostname } = new URL(url);
  return protocol === 'vscode-webview:' || hostname.endsWith(LOCAL_RESOURCE_HOST_SUFFIX);
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
    key.endsWith(LOCAL_RESOURCE_HOST_SUFFIX) ||
    ['data', 'blob', 'file', 'vscode-webview', 'vscode-file'].includes(key)
  );
}

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
 * Opens the preview through the extension's own command, so the webview and
 * its CSP are the production ones. The editor-title button comes first: it is
 * a real click, while VS Code closes the palette when the window loses focus,
 * and a window under a bare Xvfb has no reliable focus.
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
 * Finds the preview's webview frame. VS Code nests the extension's content in a
 * child of a `vscode-webview://<uuid>/index.html` host frame. Both report a
 * `vscode-webview://` origin, so the DOM (`#r3f-root`) identifies it. A frame
 * whose evaluate throws is detached or still navigating.
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
 * Waits for a sized WebGL canvas. An unsized 300x150 canvas means the React
 * tree has not laid out or WebGL context creation failed, and either way a
 * readback would be a false negative.
 */
async function waitForSizedCanvas(frame, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sizes = await frame
      .evaluate(() =>
        [...document.querySelectorAll('canvas')].map(({ width, height }) => ({ width, height }))
      )
      .catch(() => []);
    if (sizes.some(isSizedCanvas)) return true;
    await sleep(400);
  }
  return false;
}

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
 * @property {[Function, unknown][]} [initScripts] `[script, argument]` pairs installed
 *   before the webview exists, so each runs in the preview frame ahead of the app
 * @property {boolean} verbose         stream VS Code stdout/stderr
 * @property {{ file: string, contents: string }} [edit] a file to overwrite once the
 *   canvas settles, for a **Dependency hot-reload**. The run then waits for the canvas
 *   to change and settle again, and writes that frame to `canvas-edited.png`.
 * @property {Record<string, unknown>} [settings] extra user settings to seed
 *   the throwaway profile with, for callers that need a layout the palette
 *   commands would otherwise have to click their way to
 * @property {(message: string) => void} [log] progress sink
 */

/**
 * Launches the build `@vscode/test-electron` downloads, opens the preview and
 * counts the ink in its webview frame. The extension-host suite cannot see
 * into the sandboxed webview, so it proves the handshake but never a paint.
 * @param {DriveSceneOptions} options
 */
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
    initScripts = [],
    edit,
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
  let relay;
  try {
    const version = await waitForCdp(port, 90_000);
    report.browser = version.Browser;
    emit(`CDP up: ${version.Browser}`);

    ({ browser, relay } = await connectOverCdp(port, emit));
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
      const bucket = isWebviewUrl(frameUrl) ? report.requestHosts.webview : report.requestHosts.workbench;
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
        origin: isWebviewUrl(frameUrl) ? 'webview' : 'workbench',
      });
    });

    // The renderer answers CDP well before the workbench has laid itself out;
    // keystrokes sent in that window are swallowed.
    await page.bringToFront().catch(() => {});
    await page.locator('.monaco-workbench').waitFor({ state: 'visible', timeout: 60_000 });
    await sleep(3000);

    // Injected before the webview iframe exists, so it lands in that frame too.
    // CDP injection is exempt from the page's CSP, so it instruments a webview
    // whose CSP is `default-src 'none'` with no test-only branch in the app.
    if (preserveBuffer) await page.addInitScript(preserveWebglDrawingBuffer);
    await page.addInitScript(installCaptureStateProbe, CAPTURE_STATE_OF_MESSAGE);
    await page.addInitScript(() => {
      // A blocked resource does not always reach the console channel CDP exposes.
      globalThis.__textsceneCspViolations = [];
      addEventListener('securitypolicyviolation', (event) => {
        globalThis.__textsceneCspViolations.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          source: event.sourceFile,
        });
        console.error(`[csp-violation] ${event.effectiveDirective} blocked ${event.blockedURI}`);
      });
    });
    report.preserveDrawingBuffer = preserveBuffer;
    for (const [script, argument] of initScripts) await page.addInitScript(script, argument);

    if (prepareLayout) {
      // The Chat/Copilot auxiliary bar is open on a fresh profile and takes
      // ~300px from the editor area. The toggle is deterministic only because
      // the profile is fresh.
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
      // Drop the raw .tscn editor so the webview fills the editor area: a
      // half-width canvas makes small text unreadable in the screenshot.
      await palette(page, 'View: Close Editors in Other Groups');
      await waitForSizedCanvas(frame, 20_000);
    }
    if (prepareLayout) {
      // Toasts (git-repository prompts, extension notices) float OVER the
      // webview and land in the screenshot.
      await palette(page, 'Notifications: Clear All Notifications');
    }

    // Ready waits for every resource and texture the scene uses, so the settle cannot match two
    // frames drawn before they landed.
    report.captureState = await waitForCaptureReady(frame, SETTLE_POLL);
    emit(`capture state ${report.captureState ?? 'never posted'}`);

    if (preserveBuffer) {
      const settled = await stabilizeCanvas(frame, SETTLE_POLL);
      report.canvasStable = settled.stable;
      emit(`canvas ${settled.stable ? 'stabilized' : 'NEVER stabilized'}`);
    } else {
      // Without the readback patch every read comes back blank, so there is
      // nothing to compare.
      report.canvasStable = null;
    }
    if (settle > 0) await sleep(settle);
    const dataUrl = await readCanvasDataUrl(frame);

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
    // The in-frame listener runs inside the preview document, so anything it
    // caught violates the preview's own CSP.
    report.cspViolations.push(
      ...(report.frameProbe.cspViolations ?? []).map((entry) => ({ ...entry, origin: 'webview' }))
    );

    const canvasPath = path.join(outDir, 'canvas.png');
    const readback = writeCanvasPng(dataUrl, canvasPath);
    report.canvasReadback = readback ?? { error: dataUrl ?? 'no canvas' };
    if (readback) report.canvasPath = canvasPath;

    if (edit) report.edit = await applyEdit(frame, edit, dataUrl, outDir, emit);

    if (screenshots) {
      const workbenchShot = await page.screenshot();
      writeFileSync(path.join(outDir, 'workbench.png'), workbenchShot);
      report.workbenchScreenshot = inkStats(workbenchShot);

      const frameElement = await frame.frameElement();
      const webviewShot = await frameElement.screenshot();
      writeFileSync(path.join(outDir, 'webview.png'), webviewShot);
      report.webviewScreenshot = inkStats(webviewShot);
    }

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
    await relay?.close();
    await stopVscode(child, userDataDir);
    rmSync(userDataDir, { recursive: true, force: true });
  }

  return report;
}

/**
 * Overwrites `edit.file` and waits for the preview to redraw from it: first a frame
 * that differs from `baseline`, then two identical readbacks. Writes the settled
 * frame to `canvas-edited.png`.
 */
async function applyEdit(frame, edit, baseline, outDir, emit) {
  writeFileSync(edit.file, edit.contents);
  emit(`edited ${path.basename(edit.file)}`);
  const changed = await waitForCanvasChange(frame, baseline, EDIT_POLL);
  emit(`canvas ${changed ? 'changed' : 'NEVER changed'} after the edit`);
  const settled = await stabilizeCanvas(frame, SETTLE_POLL);
  const canvasPath = path.join(outDir, 'canvas-edited.png');
  const canvasReadback = writeCanvasPng(settled.dataUrl, canvasPath);
  return { changed, stable: settled.stable, ...(canvasReadback && { canvasPath, canvasReadback }) };
}

/**
 * The preview-scoped slice of a report. The workbench on `vscode-file://`
 * contributes marketplace lookups, built-in extension warnings and its own CDN
 * at startup, so only these filtered counts can be required to be zero.
 */
export function summarizeWebview(report) {
  return {
    cspViolations: report.cspViolations.filter((entry) => entry.origin === 'webview'),
    failedRequests: report.failedRequests.filter((entry) => entry.origin === 'webview'),
    consoleErrors: report.console.filter((entry) => entry.origin === 'webview' && entry.type === 'error'),
    requestHosts: report.requestHosts.webview,
    offendingHosts: Object.keys(report.requestHosts.webview).filter((key) => !isOfflineWebviewOrigin(key)),
  };
}
