/**
 * VS Code previewer showcase capture.
 *
 * Launches the extension dev-host against the committed example scenes, then for
 * each target scene drives the workbench so OUR previewer is the subject of the
 * shot (not raw .tscn text or the Copilot sidebar): close the Copilot auxiliary
 * bar, open the scene, run "Open Preview to the Side", close the source editor so
 * the webview fills the editor area, wait for the 3D canvas to actually paint,
 * then screenshot the whole window (keeping the VS Code chrome + Explorer for
 * "this is VS Code" context).
 *
 *   node scripts/showcase/vscode/capture.mjs [sceneKey ...]
 *
 * Prerequisite: build the extension first so dist/extension.js + the webview
 * bundle exist that --extensionDevelopmentPath loads:
 *
 *   pnpm --filter textscene-inspector build
 *
 * Cross-platform: the VS Code binary is resolved from $VSCODE_BIN, then a
 * `code`/`code.exe` on PATH, then @vscode/test-electron's cached (or freshly
 * downloaded) build — the same cache the integration suite uses. On Linux
 * without $DISPLAY the launch self-wraps in xvfb-run and forces software GL
 * (SwiftShader) so the webview's WebGL canvas paints headless, mirroring the
 * chromium flags the web showcase + visual suite use and the sandbox flags
 * @vscode/test-electron injects for its CI-proven xvfb launch.
 */
/* global document */ // `document` appears only inside page.frames().evaluate() callbacks, which run in the browser.
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { rmSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';
// Linux with no X server → drive VS Code under a virtual framebuffer.
const HEADLESS = IS_LINUX && !process.env.DISPLAY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kill only OUR dev-host instances (matched by the user-data-dir marker), never the user's VS Code. */
function killStaleHost(udMarker) {
  try {
    if (IS_WIN) {
      execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Code.exe'\\" | Where-Object { $_.CommandLine -like '*${udMarker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
        { stdio: 'ignore' }
      );
    } else {
      // SIGKILL (mirrors the Windows -Force above): the dev-host's Electron
      // main catches SIGTERM and shuts down slowly under xvfb, so a plain
      // signal leaks orphans. pkill -f matches the full command line; only our
      // dev-host (and its xvfb-run wrapper) carry the showcase --user-data-dir
      // marker, so the user's own VS Code (a different user-data-dir) is never
      // touched — nor is this node process (its argv is just the script path).
      execSync(`pkill -9 -f -- ${udMarker}`, { stdio: 'ignore' });
    }
  } catch { /* nothing matched (pkill exits 1 when no process matches) */ }
}

/** SIGKILL the launched process group — xvfb-run + Xvfb + the dev-host it wraps. */
function killProcessTree(proc) {
  try {
    // Negative PID targets the whole process group. `detached` made the spawned
    // command a group leader (pgid === proc.pid), so this reaches the Xvfb that
    // xvfb-run started — it carries no user-data-dir marker for killStaleHost to
    // match, and xvfb-run's own cleanup trap does not fire on a killed parent.
    if (IS_WIN) proc.kill();
    else process.kill(-proc.pid, 'SIGKILL');
  } catch { /* already gone */ }
}

/** Remove the throwaway user-data-dir, retrying while a dying host still holds a lock. */
async function rmRetry(dir) {
  for (let i = 0; i < 12; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { /* locked — host still dying */ }
    await sleep(500);
  }
}

const WT = process.cwd();
const EXT = `${WT}/apps/textscene-vscode`;
// Open the committed example scenes as the workspace: self-contained .tscn with
// no .csproj/.cs, so the C# Dev Kit never activates and hijacks focus with its
// welcome page. Same scenes as the web showcase.
const WS = `${WT}/scenes/examples`;
const UD = `${WT}/.tmp/vsc-showcase-ud`;
const OUT = `${WT}/docs/screenshots/vscode`;
const PORT = 9222;
// Reuse the VS Code the integration suite already downloads (pnpm --filter
// textscene-inspector test:integration caches here); avoids a redundant fetch.
const VSCODE_CACHE = `${EXT}/.vscode-test`;

// Workspace-relative paths within the examples workspace → output screenshot name + caption.
const SCENES = {
  'vscode-main': { file: 'example-ui-dialog.tscn', desc: 'a 2D-UI field-journal dialog rendered by the Control overlay' },
  'vscode-hallway': { file: 'example-hallway-mockup.tscn', desc: 'a self-contained CSG hallway mockup with portrait frames' },
};

const wanted = process.argv.slice(2);
const keys = wanted.length ? wanted : Object.keys(SCENES);

/** Platform executable inside a downloaded VS Code dir (mirrors @vscode/test-electron). */
function execInDir(dir) {
  if (IS_WIN) return `${dir}/Code.exe`;
  if (process.platform === 'darwin') return `${dir}/Visual Studio Code.app/Contents/MacOS/Electron`;
  return `${dir}/code`;
}

/** A finished VS Code build already sitting in the shared cache, or null. */
function cachedVscode() {
  if (!existsSync(VSCODE_CACHE)) return null;
  const dirs = readdirSync(VSCODE_CACHE)
    .filter((d) => d.startsWith('vscode-') && existsSync(`${VSCODE_CACHE}/${d}/is-complete`))
    .sort();
  for (const d of dirs.reverse()) {
    const exe = execInDir(`${VSCODE_CACHE}/${d}`);
    if (existsSync(exe)) return exe;
  }
  return null;
}

/** A `code`/`code.exe` on PATH, or null. */
function codeOnPath() {
  try {
    const probe = IS_WIN ? 'where code.exe 2>NUL & where code.cmd 2>NUL' : 'command -v code';
    const out = execSync(probe, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    return out || null;
  } catch { return null; }
}

/** Resolve a VS Code binary: $VSCODE_BIN → PATH → shared cache → download. */
async function resolveVscodeBin() {
  if (process.env.VSCODE_BIN) return { bin: process.env.VSCODE_BIN, viaPath: false };
  const onPath = codeOnPath();
  if (onPath) return { bin: onPath, viaPath: true };
  const cached = cachedVscode();
  if (cached) return { bin: cached, viaPath: false };
  console.log('[vscode] no cached/installed VS Code — downloading (first run, a few minutes)…');
  const bin = await downloadAndUnzipVSCode({ cachePath: VSCODE_CACHE });
  return { bin, viaPath: false };
}

async function waitCDP() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/json/version`); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(1000);
  }
  throw new Error('CDP never came up');
}

/** Run a command-palette command by its visible label. */
async function palette(page, label) {
  await page.keyboard.press('Escape'); // dismiss any stray menu/notification first
  await sleep(150);
  await page.keyboard.press('Control+Shift+P');
  await sleep(500);
  await page.keyboard.type(label, { delay: 8 });
  await sleep(800); // let the fuzzy filter settle on the top match
  await page.keyboard.press('Enter');
  await sleep(700);
}

/** Open a workspace file via Quick Open. */
async function openFile(page, relPath) {
  await page.keyboard.press('Escape');
  await sleep(150);
  await page.keyboard.press('Control+P');
  await sleep(500);
  await page.keyboard.type(relPath, { delay: 8 });
  await sleep(900);
  await page.keyboard.press('Enter');
  await sleep(900);
}

/** Poll every frame for the previewer's #r3f-root canvas being painted. */
async function waitForCanvas(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      try {
        const ok = await f.evaluate(() => {
          const root = document.getElementById('r3f-root');
          const c = document.querySelector('canvas');
          return !!root && !!c && c.width > 50 && c.height > 50;
        });
        if (ok) return true;
      } catch { /* cross-origin / detached frame — skip */ }
    }
    await sleep(500);
  }
  return false;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(`${WT}/.tmp`, { recursive: true });
const UD_MARKER = 'vsc-showcase-ud';
killStaleHost(UD_MARKER); // a prior aborted run can leave the host holding the dir
await rmRetry(UD);

const { bin, viaPath } = await resolveVscodeBin();

const vscodeArgs = [
  `--extensionDevelopmentPath=${EXT}`,
  `--user-data-dir=${UD}`,
  `--remote-debugging-port=${PORT}`,
  '--new-window', '--disable-workspace-trust', '--disable-updates',
  '--skip-welcome', '--skip-release-notes',
];
if (IS_LINUX) {
  // Sandbox flags: the cached chrome-sandbox is not setuid, so the namespace
  // sandbox may be unavailable under xvfb — @vscode/test-electron passes these
  // for exactly this reason. GL flags force ANGLE + SwiftShader so the webview's
  // WebGL context paints in software (never --disable-gpu, which kills WebGL).
  vscodeArgs.push(
    '--no-sandbox', '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle',
  );
}
vscodeArgs.push(WS);

let cmd = bin;
let spawnArgs = vscodeArgs;
if (HEADLESS) {
  cmd = 'xvfb-run';
  // -a: pick a free display. 24-bit depth is required for GL; 1920x1080 also
  // sizes the window and therefore the screenshot. The -screen string is ONE
  // argv element (no shell) — spawn passes it verbatim to xvfb-run's getopt.
  spawnArgs = ['-a', '--server-args=-screen 0 1920x1080x24', bin, ...vscodeArgs];
}
// On Windows a `code` resolved from PATH is code.cmd, which needs a shell to run.
const useShell = IS_WIN && viaPath;

console.log(`[vscode] launching dev-host (${cmd === 'xvfb-run' ? `xvfb-run → ${bin}` : bin})…`);
// detached (POSIX): make the launch a process-group leader so cleanup can
// SIGKILL the whole tree — xvfb-run, the Xvfb it spawns, and the dev-host.
const proc = spawn(cmd, spawnArgs, { shell: useShell, stdio: 'ignore', detached: !IS_WIN });

let browser;
try {
  await waitCDP();
  await sleep(5000); // window settle
  browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
  const page = browser.contexts()[0].pages().find((p) => /workbench/.test(p.url())) ?? browser.contexts()[0].pages()[0];
  await page.bringToFront().catch(() => {});
  if (process.env.VSC_DEBUG) {
    const attach = (p) => {
      p.on('console', (m) => { const t = m.text(); if (/error|fail|glb|resource|scene|not text|denied|csp|worker/i.test(t) && !/Extension Host|lock file|SSE_PORT/.test(t)) console.log('  [console]', t.slice(0, 240)); });
      p.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 240)));
    };
    const ctx = browser.contexts()[0];
    ctx.on('page', attach);
    ctx.pages().forEach(attach);
  }
  // Clear any first-launch notifications/toasts before driving.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(300); }

  // One-time workbench prep: hide the Copilot auxiliary (secondary) side bar.
  await palette(page, 'View: Toggle Secondary Side Bar Visibility');
  await sleep(500);

  for (const key of keys) {
    const scene = SCENES[key];
    if (!scene) { console.warn(`[vscode] unknown scene key "${key}"`); continue; }
    console.log(`[vscode] ${key} ← ${scene.file}`);
    await palette(page, 'View: Close All Editors');
    await openFile(page, scene.file);
    await palette(page, 'TextScene: Open Preview to the Side');
    await sleep(1500);
    await palette(page, 'View: Close Editors in Other Groups'); // drop the raw .tscn source
    let painted = await waitForCanvas(page);
    if (!painted) {
      // Cold-start race: on the FIRST .tscn the extension may still be
      // activating when the preview command runs, so it no-ops and the editor
      // stays on the welcome page. Retry once now that activation has completed.
      console.log('[vscode]   no canvas yet — retrying preview after activation…');
      await openFile(page, scene.file);
      await palette(page, 'TextScene: Open Preview to the Side');
      await sleep(1500);
      await palette(page, 'View: Close Editors in Other Groups');
      painted = await waitForCanvas(page);
    }
    await sleep(9000); // settle: GLBs + textures stream over the webview base64 bridge after first paint
    const path = `${OUT}/${key}.png`;
    await page.screenshot({ path });
    console.log(`[vscode]   ${painted ? 'canvas painted' : 'TIMEOUT (no canvas)'} → ${path}`);
  }
} catch (e) {
  console.error('[vscode] FAIL:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } catch { /* already gone */ }
  killProcessTree(proc); // xvfb-run + Xvfb + dev-host process group
  // Belt-and-suspenders: any dev-host process that escaped the group (e.g. a
  // re-parented Electron helper) still carries the user-data-dir marker.
  killStaleHost(UD_MARKER);
}
