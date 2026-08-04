#!/usr/bin/env node
/**
 * Drive the REAL VS Code with the TextScene extension loaded, over CDP.
 *
 * The extension renders its preview inside a webview — a sandboxed
 * `vscode-webview://` iframe the extension host cannot see into. Integration
 * tests (`pnpm --filter textscene-inspector test:integration`) therefore prove
 * only that the webview loads and completes its handshake, never that anything
 * painted. This script closes that gap: it launches the downloaded VS Code
 * build with `--remote-debugging-port`, attaches Playwright over CDP, walks
 * into the webview frame, screenshots it, and counts ink pixels.
 *
 * Usage:
 *   node scripts/vscode/drive-vscode.mjs <scene.tscn> [options]
 *
 *   --out <dir>        output dir (default scripts/vscode/output/<scene-name>)
 *   --workspace <dir>  workspace folder to open (default: the scene's dir)
 *   --port <n>         CDP port (default 9444)
 *   --settle <ms>      wait after the canvas appears before capturing (default 6000)
 *   --eval <file.mjs>  ES module whose default export is a self-contained
 *                      function; it is serialised, run inside the webview
 *                      frame, and its JSON result lands in report.evalResult
 *   --split            keep the .tscn source editor open beside the preview
 *                      (default: close it so the webview fills the window)
 *   --no-preserve-buffer
 *                      skip the `preserveDrawingBuffer` patch (the canvas
 *                      readback then reads blank — kept so the claim in
 *                      `.claude/skills/drive-vscode-extension` stays testable)
 *   --headed           use the ambient DISPLAY instead of xvfb-run
 *   --keep-open <ms>   keep VS Code alive this long after capture (debugging)
 *   --verbose          stream VS Code stdout/stderr
 *
 * Writes `<out>/workbench.png`, `<out>/webview.png`, `<out>/canvas.png` (the
 * WebGL readback, when it succeeds) and `<out>/report.json`, and prints a
 * summary. Exits non-zero if the preview never opened or the webview frame
 * never appeared.
 */
/* global document, HTMLCanvasElement, addEventListener */
// Those globals appear only inside `evaluate`/`addInitScript` callbacks, which
// are serialised and run in the browser, never in this Node process.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { inkStats } from './pixels.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSION_DIR = path.join(REPO_ROOT, 'apps/textscene-vscode');
const VSCODE_TEST_DIR = path.join(EXTENSION_DIR, '.vscode-test');

// ============================================================================
// Args
// ============================================================================

function parseArgs(argv) {
  const opts = {
    scene: undefined,
    out: undefined,
    workspace: undefined,
    port: 9444,
    settle: 6000,
    evalFile: undefined,
    headed: false,
    keepOpen: 0,
    split: false,
    preserveBuffer: true,
    verbose: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out': opts.out = argv[++i]; break;
      case '--workspace': opts.workspace = argv[++i]; break;
      case '--port': opts.port = Number(argv[++i]); break;
      case '--settle': opts.settle = Number(argv[++i]); break;
      case '--eval': opts.evalFile = argv[++i]; break;
      case '--headed': opts.headed = true; break;
      case '--split': opts.split = true; break;
      case '--no-preserve-buffer': opts.preserveBuffer = false; break;
      case '--keep-open': opts.keepOpen = Number(argv[++i]); break;
      case '--verbose': opts.verbose = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
        rest.push(arg);
    }
  }
  opts.scene = rest[0];
  if (!opts.scene) throw new Error('Usage: drive-vscode.mjs <scene.tscn> [options]');
  return opts;
}

// ============================================================================
// Preflight
// ============================================================================

/**
 * Finds the VS Code build that `@vscode/test-electron` downloaded for the
 * integration suite. Nothing else in the repo ships a VS Code binary, so a
 * miss means the integration tests have never been run in this worktree.
 */
function findVscodeBinary() {
  if (!existsSync(VSCODE_TEST_DIR)) return null;
  const candidates = readdirSync(VSCODE_TEST_DIR)
    .filter((entry) => entry.startsWith('vscode-'))
    .map((entry) => path.join(VSCODE_TEST_DIR, entry, 'code'))
    .filter((candidate) => existsSync(candidate));
  return candidates.sort().pop() ?? null;
}

function preflight(opts) {
  const binary = findVscodeBinary();
  if (!binary) {
    throw new Error(
      `No VS Code build under ${VSCODE_TEST_DIR}. Run ` +
        `\`pnpm --filter textscene-inspector test:integration\` once — it downloads one.`
    );
  }
  for (const built of ['dist/extension.js', 'dist/webview/webview.js']) {
    if (!existsSync(path.join(EXTENSION_DIR, built))) {
      throw new Error(
        `Missing ${built}. Run \`pnpm --filter textscene-inspector build\` first.`
      );
    }
  }
  if (!existsSync(opts.scene)) throw new Error(`Scene not found: ${opts.scene}`);
  return binary;
}

// ============================================================================
// Launch
// ============================================================================

/**
 * Seeds a throwaway user-data dir. Without these settings a first-run VS Code
 * opens the Welcome tab over the editor and starts talking to the update and
 * telemetry endpoints, which pollutes the offline check.
 */
function seedUserDataDir() {
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
// Opening the preview
// ============================================================================

/**
 * Clicks the editor-title "Open Preview to the Side" action the extension
 * contributes for `.tscn` files, falling back to the command palette.
 *
 * The title-bar button is preferred because it is a real mouse event on a
 * visible element: the command palette is a quick-input widget that VS Code
 * dismisses when the window loses focus, and a window under a bare Xvfb (no
 * window manager) does not reliably have focus.
 */
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

// ============================================================================
// Pixel accounting
// ============================================================================

// `inkStats` lives in ./pixels.mjs — shared with ink-diff.mjs and unit-tested
// there, since this file's `await main()` makes it unimportable.

// ============================================================================
// Main
// ============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scene = path.resolve(opts.scene);
  const binary = preflight({ ...opts, scene });
  const workspace = path.resolve(opts.workspace ?? path.dirname(scene));
  const outDir = path.resolve(
    opts.out ?? path.join(REPO_ROOT, 'scripts/vscode/output', path.basename(scene, '.tscn'))
  );
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const userDataDir = seedUserDataDir();
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

  console.log(`[drive] VS Code:   ${binary}`);
  console.log(`[drive] scene:     ${scene}`);
  console.log(`[drive] workspace: ${workspace}`);
  console.log(`[drive] out:       ${outDir}`);

  const { child, log } = launchVscode({ ...opts, binary, scene, workspace, userDataDir });
  let browser;
  try {
    const version = await waitForCdp(opts.port, 90_000);
    report.browser = version.Browser;
    console.log(`[drive] CDP up: ${version.Browser}`);

    browser = await chromium.connectOverCDP(`http://127.0.0.1:${opts.port}`);
    const page = await findWorkbenchPage(browser, 60_000);
    console.log(`[drive] workbench page: ${page.url().slice(0, 80)}…`);
    // Listeners first, so nothing logged during workbench startup is missed.
    page.on('console', (message) => {
      const entry = { type: message.type(), text: message.text(), url: message.location()?.url };
      report.console.push(entry);
      if (/Content Security Policy|Refused to/i.test(entry.text)) report.cspViolations.push(entry);
    });
    page.on('pageerror', (error) => report.pageErrors.push(String(error)));
    // Which origins the page talks to, bucketed by the frame that asked. The
    // webview's own bucket is the offline evidence: anything other than
    // `vscode-resource`/`data:` there means the preview reached the network.
    page.on('request', (request) => {
      const url = request.url();
      const scheme = url.split(':')[0];
      const host = /^https?$/.test(scheme) ? new URL(url).host : scheme;
      const bucket = request.frame()?.url()?.startsWith('vscode-webview://')
        ? report.requestHosts.webview
        : report.requestHosts.workbench;
      bucket[host] = (bucket[host] ?? 0) + 1;
    });
    page.on('requestfailed', (request) =>
      report.failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        frameUrl: request.frame()?.url(),
      })
    );

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
    await page.addInitScript((preserveBuffer) => {
      if (preserveBuffer) {
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
    }, opts.preserveBuffer);
    report.preserveDrawingBuffer = opts.preserveBuffer;

    // The Chat/Copilot auxiliary bar is open on a fresh profile and steals ~300px
    // from the editor area. A toggle is only deterministic because the profile
    // IS fresh — it is visible on every first launch.
    await palette(page, 'View: Toggle Secondary Side Bar Visibility');

    report.openedVia = await openPreview(page);
    console.log(`[drive] preview opened via ${report.openedVia}`);

    let frame = await findWebviewFrame(page, 60_000);
    report.webviewFrameUrl = frame.url();
    report.frameTree = page.frames().map((candidate) => ({
      url: candidate.url().slice(0, 120),
      parent: candidate.parentFrame()?.url().slice(0, 60) ?? null,
    }));
    console.log(`[drive] webview frame: ${frame.url().slice(0, 80)}…`);

    if (!(await waitForSizedCanvas(frame, 45_000))) {
      // Cold-start race: on the first .tscn of a session the extension can
      // still be activating when the command fires, so the panel opens empty.
      console.log('[drive] no sized canvas — reopening the preview…');
      report.reopened = true;
      await openPreview(page);
      frame = await findWebviewFrame(page, 30_000);
      if (!(await waitForSizedCanvas(frame, 45_000))) {
        report.sizedCanvas = false;
        throw new Error('Webview never produced a sized canvas (see report.json / workbench.png)');
      }
    }
    report.sizedCanvas = true;

    if (!opts.split) {
      // Drop the raw .tscn editor so the webview fills the editor area — a
      // half-width canvas makes small text unreadable in the screenshot.
      await palette(page, 'View: Close Editors in Other Groups');
      await waitForSizedCanvas(frame, 20_000);
    }
    // Toasts (git-repository prompts, extension notices) float OVER the
    // webview and land in the screenshot.
    await palette(page, 'Notifications: Clear All Notifications');
    await sleep(opts.settle);

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
    report.cspViolations.push(...(report.frameProbe.cspViolations ?? []));

    const dataUrl = await frame.evaluate(() => {
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
    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
      const buffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
      writeFileSync(path.join(outDir, 'canvas.png'), buffer);
      report.canvasReadback = inkStats(buffer);
    } else {
      report.canvasReadback = { error: dataUrl ?? 'no canvas' };
    }

    // --- screenshots --------------------------------------------------------
    const workbenchShot = await page.screenshot();
    writeFileSync(path.join(outDir, 'workbench.png'), workbenchShot);
    report.workbenchScreenshot = inkStats(workbenchShot);

    const frameElement = await frame.frameElement();
    const webviewShot = await frameElement.screenshot();
    writeFileSync(path.join(outDir, 'webview.png'), webviewShot);
    report.webviewScreenshot = inkStats(webviewShot);

    // --- optional user evaluation ------------------------------------------
    if (opts.evalFile) {
      const source = await import(path.resolve(opts.evalFile));
      report.evalResult = await frame.evaluate(source.default);
    }

    if (opts.keepOpen > 0) {
      console.log(`[drive] holding VS Code open for ${opts.keepOpen}ms…`);
      await sleep(opts.keepOpen);
    }
  } catch (error) {
    report.error = String(error?.stack ?? error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.vscodeLogTail = log.slice(-40).join('');
    writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    // Close the CDP connection before killing VS Code: Playwright treats a
    // vanished target as a crash and throws over the top of the real error.
    if (browser) await browser.close().catch(() => {});
    await stopVscode(child, userDataDir);
    rmSync(userDataDir, { recursive: true, force: true });
    printSummary(report, outDir);
  }
}

function printSummary(report, outDir) {
  const line = (label, stats) => {
    if (!stats) return;
    if (stats.error) {
      console.log(`  ${label.padEnd(12)} ERROR ${stats.error}`);
      return;
    }
    console.log(
      `  ${label.padEnd(12)} ${stats.width}x${stats.height}  ink=${stats.inkPixels}` +
        `  opaque=${stats.nonTransparentPixels}  colors=${stats.distinctColors}` +
        `  bg=${stats.dominantColor} (${(stats.dominantShare * 100).toFixed(1)}%)`
    );
  };
  console.log('\n[drive] pixel report');
  line('canvas', report.canvasReadback);
  line('webview', report.webviewScreenshot);
  line('workbench', report.workbenchScreenshot);
  console.log(`  webview requests: ${JSON.stringify(report.requestHosts?.webview ?? {})}`);
  console.log(
    `  csp-violations=${report.cspViolations.length}` +
      `  failed-requests=${report.failedRequests.length}` +
      `  page-errors=${report.pageErrors.length}` +
      `  console-errors=${report.console.filter((entry) => entry.type === 'error').length}`
  );
  console.log(`[drive] artifacts in ${outDir}`);
}

await main();
