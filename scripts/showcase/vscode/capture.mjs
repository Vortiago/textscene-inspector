/**
 * VS Code previewer screenshot capture — the one owner of
 * `docs/screenshots/vscode/`.
 *
 * Launches the extension dev-host against a throwaway copy of the fixtures,
 * then drives the workbench so OUR previewer is the subject of every shot (not
 * raw .tscn text, not the Copilot sidebar, and never a pane left open by the
 * shot before it). It covers the two showcase captures and every image
 * `docs/user-guide-vscode.md` embeds.
 *
 *   node scripts/showcase/vscode/capture.mjs [shotKey ...]
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
 * (where everything is), `devHost` (find, launch and kill VS Code),
 * `workbench` (driving the running window) and `guideShots` (the user-guide
 * recipes).
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { assertPortFree } from '../../visual/previewServer.mjs';
import { sleep } from './capture/platform.mjs';
import { FIXTURES, OUT, PORT, TMP, UD, WS } from './capture/paths.mjs';
import { killPortOrphan, killProcessTree, killStaleHost, launchDevHost, rmRetry, seedUserData, waitCDP } from './capture/devHost.mjs';
import { openScenePreview, palette, settle, shoot, workbenchPage } from './capture/workbench.mjs';
import { GUIDE_SHOTS, SHOT_CHAINS } from './capture/guideShots.mjs';

const SHOWCASE_SHOTS = {
  'vscode-main': { desc: 'a 2D-UI field-journal dialog rendered by the Control painters', run: shotOfScene('example-ui-dialog.tscn') },
  'vscode-hallway': { desc: 'a self-contained CSG hallway mockup with portrait frames', run: shotOfScene('example-hallway-mockup.tscn') },
};

function shotOfScene(file) {
  return async (page) => {
    const painted = await openScenePreview(page, file);
    await settle();
    return painted;
  };
}

const SHOTS = { ...SHOWCASE_SHOTS, ...GUIDE_SHOTS };

/** Extend the requested keys with any shot they continue, keeping shot order. */
function withChains(requested) {
  const needed = new Set(requested);
  for (const chain of SHOT_CHAINS) {
    for (let i = 1; i < chain.length; i++) {
      if (needed.has(chain[i])) for (let j = 0; j < i; j++) needed.add(chain[j]);
    }
  }
  return Object.keys(SHOTS).filter((key) => needed.has(key));
}

const wanted = process.argv.slice(2);
const unknown = wanted.filter((key) => !SHOTS[key]);
if (unknown.length) {
  console.error(`[vscode] unknown shot key(s): ${unknown.join(', ')}`);
  console.error(`[vscode] known: ${Object.keys(SHOTS).join(', ')}`);
  process.exit(1);
}
const keys = wanted.length ? withChains(wanted) : Object.keys(SHOTS);

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
// A pristine copy per run: the hot-reload shots rewrite a scene in it, and a
// previous run that died mid-edit must not seed this one's "before" shot.
rmSync(WS, { recursive: true, force: true });
cpSync(FIXTURES, WS, { recursive: true });
// Match on the ABSOLUTE user-data-dir: the basename alone is identical in
// every worktree, so it would SIGKILL a concurrent capture's dev-host in a
// sibling worktree (this machine runs many at once).
const UD_MARKER = UD;
killStaleHost(UD_MARKER); // a prior aborted run can leave the host holding the dir
await rmRetry(UD);
seedUserData(UD);
// The SIGKILL above is delivered, not awaited; a host still dying holds the port.
await sleep(500);
// A helper the dead host forked can outlive it holding the debugging socket,
// and it carries no user-data-dir for killStaleHost to match on.
killPortOrphan(PORT);
// A sibling worktree's dev-host is spared by design and keeps answering here.
// `waitCDP` polls for *a* 200 and `connectOverCDP` attaches to whatever answers,
// so without this the shots below would be of the WRONG build, exit code 0.
await assertPortFree(PORT, 'VSCODE_CDP_PORT');

const { proc, launchFailed } = await launchDevHost();

const failed = [];
let browser;
try {
  await Promise.race([waitCDP(), launchFailed]);
  await sleep(5000); // window settle
  browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
  const page = await workbenchPage(browser);
  // Clear any first-launch notifications/toasts before driving.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(300); }

  // One-time workbench prep: hide the Copilot auxiliary (secondary) side bar.
  await palette(page, 'View: Close Secondary Side Bar');
  await sleep(500);

  for (const key of keys) {
    console.log(`[vscode] ${key} — ${SHOTS[key].desc}`);
    try {
      const painted = await SHOTS[key].run(page);
      await shoot(page, key, painted);
      // Undo any workbench state this shot turned on for itself, so the next
      // one starts from the same window the first one did.
      await SHOTS[key].after?.(page);
      if (!painted) failed.push(key);
    } catch (e) {
      // One broken recipe must not cost the other twenty-three shots.
      console.error(`[vscode]   FAILED: ${e.message}`);
      failed.push(key);
    }
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
if (failed.length) {
  console.error(`[vscode] ${failed.length} shot(s) did not reach their state: ${failed.join(', ')}`);
  process.exitCode = 1;
}
// waitCDP()'s poll loop (or a lost Promise.race branch on launch failure) can
// keep the event loop alive after cleanup; exit explicitly so a failed launch
// terminates promptly instead of lingering until the CDP timeout.
process.exit(process.exitCode ?? 0);
