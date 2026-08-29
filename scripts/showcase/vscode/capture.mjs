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
 *
 * The parts live in `capture/`: `platform` (what the OS decides), `paths`
 * (where everything is), `devHost` (find, launch and kill VS Code) and
 * `workbench` (driving the running window).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { assertPortFree } from '../../visual/previewServer.mjs';
import { sleep } from './capture/platform.mjs';
import { OUT, PORT, TMP, UD } from './capture/paths.mjs';
import { killProcessTree, killStaleHost, launchDevHost, rmRetry, waitCDP } from './capture/devHost.mjs';
import { captureSceneShot, palette, workbenchPage } from './capture/workbench.mjs';

// Workspace-relative paths within the examples workspace → output screenshot name + caption.
const SCENES = {
  'vscode-main': { file: 'example-ui-dialog.tscn', desc: 'a 2D-UI field-journal dialog rendered by the Control overlay' },
  'vscode-hallway': { file: 'example-hallway-mockup.tscn', desc: 'a self-contained CSG hallway mockup with portrait frames' },
};

const wanted = process.argv.slice(2);
const keys = wanted.length ? wanted : Object.keys(SCENES);

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
// Match on the ABSOLUTE user-data-dir: the basename alone is identical in
// every worktree, so it would SIGKILL a concurrent capture's dev-host in a
// sibling worktree (this machine runs many at once).
const UD_MARKER = UD;
killStaleHost(UD_MARKER); // a prior aborted run can leave the host holding the dir
await rmRetry(UD);
// The SIGKILL above is delivered, not awaited; a host still dying holds the port.
await sleep(500);
// A sibling worktree's dev-host is spared by design and keeps answering here.
// `waitCDP` polls for *a* 200 and `connectOverCDP` attaches to whatever answers,
// so without this the shots below would be of the WRONG build, exit code 0.
await assertPortFree(PORT, 'VSCODE_CDP_PORT');

const { proc, launchFailed } = await launchDevHost();

let browser;
try {
  await Promise.race([waitCDP(), launchFailed]);
  await sleep(5000); // window settle
  browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
  const page = await workbenchPage(browser);
  // Clear any first-launch notifications/toasts before driving.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(300); }

  // One-time workbench prep: hide the Copilot auxiliary (secondary) side bar.
  await palette(page, 'View: Toggle Secondary Side Bar Visibility');
  await sleep(500);

  for (const key of keys) {
    const scene = SCENES[key];
    if (!scene) { console.warn(`[vscode] unknown scene key "${key}"`); continue; }
    await captureSceneShot(page, key, scene);
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
// waitCDP()'s poll loop (or a lost Promise.race branch on launch failure) can
// keep the event loop alive after cleanup; exit explicitly so a failed launch
// terminates promptly instead of lingering until the CDP timeout.
process.exit(process.exitCode ?? 0);
