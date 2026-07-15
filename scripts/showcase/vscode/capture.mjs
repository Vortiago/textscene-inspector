/**
 * VS Code previewer showcase capture.
 *
 * Launches the extension dev-host against the committed example scenes, then for
 * each target scene drives the workbench so OUR previewer is the subject of the
 * shot (not raw .tscn text or the Copilot sidebar): close the Copilot auxiliary
 * bar, open the scene, run "Open Preview to the Side", close the source editor so
 * the webview fills the editor area, wait for the 3D canvas to actually paint,
 * then screenshot the whole window (keeping the VS Code chrome + Explorer for
 * "this is VS Code" context). See memory: vscode-screenshot-prep.
 *
 *   node scripts/showcase/vscode/capture.mjs [sceneKey ...]
 */
/* global document */ // `document` appears only inside page.frames().evaluate() callbacks, which run in the browser.
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { rmSync, mkdirSync } from 'node:fs';

/** Kill only OUR dev-host instances (matched by the user-data-dir), never the user's VS Code. */
function killStaleHost(udMarker) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Code.exe'\\" | Where-Object { $_.CommandLine -like '*${udMarker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
      { stdio: 'ignore' }
    );
  } catch { /* none running */ }
}
function rmRetry(dir) {
  for (let i = 0; i < 12; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { /* locked — host still dying */ }
    execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds 500"', { stdio: 'ignore' });
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

// Workspace-relative paths within the examples workspace → output screenshot name + caption.
const SCENES = {
  'vscode-main': { file: 'example-ui-dialog.tscn', desc: 'a 2D-UI field-journal dialog rendered by the Control overlay' },
  'vscode-hallway': { file: 'example-hallway-mockup.tscn', desc: 'a self-contained CSG hallway mockup with portrait frames' },
};

const wanted = process.argv.slice(2);
const keys = wanted.length ? wanted : Object.keys(SCENES);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
rmRetry(UD);

console.log('[vscode] launching dev-host…');
const proc = spawn('code', [
  `--extensionDevelopmentPath=${EXT}`,
  `--user-data-dir=${UD}`,
  `--remote-debugging-port=${PORT}`,
  '--new-window', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes',
  WS,
], { shell: true, stdio: 'ignore' });

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
  try { proc.kill(); } catch { /* already gone */ }
  // The dev-host outlives the CLI wrapper — kill it synchronously by user-data-dir.
  killStaleHost(UD_MARKER);
}
