/**
 * Captures the VS Code previewer screenshots, the only writer of `docs/screenshots/vscode/`: the
 * two showcase shots and every image `docs/user-guide-vscode.md` embeds. It launches the extension
 * dev-host on a throwaway copy of the fixtures and drives the workbench, so our previewer is the
 * subject of every shot. Build the extension first: --extensionDevelopmentPath loads its bundles.
 *
 * @example
 *   pnpm --filter textscene-inspector build
 *   node scripts/showcase/vscode/capture.mjs [shotKey ...]
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { assertPortFree } from '../../visual/previewServer.mjs';
import { sleep } from './capture/platform.mjs';
import { FIXTURES, OUT, PORT, TMP, UD, WS } from './capture/paths.mjs';
import { killPortOrphan, killProcessTree, killStaleHost, launchDevHost, rmRetry, seedUserData, waitCDP } from './capture/devHost.mjs';
import { openScenePreview, palette, settle, shoot, workbenchPage } from './capture/workbench.mjs';
import { GUIDE_SHOTS } from './capture/guideShots.mjs';

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

const ORDER = Object.keys(SHOTS);
if (SHOTS[ORDER[0]].continues) throw new Error(`the first shot "${ORDER[0]}" cannot continue another`);

/**
 * Extends the requested keys with the shots they continue, in shot order. A `continues` shot
 * starts from the window its predecessor left, so a subset takes the whole chain. The backward
 * walk picks up a chain of any depth.
 */
function withChains(requested) {
  const needed = new Set(requested);
  for (let i = ORDER.length - 1; i > 0; i--) {
    if (needed.has(ORDER[i]) && SHOTS[ORDER[i]].continues) needed.add(ORDER[i - 1]);
  }
  return ORDER.filter((key) => needed.has(key));
}

const wanted = process.argv.slice(2);
const unknown = wanted.filter((key) => !SHOTS[key]);
if (unknown.length) {
  console.error(`[vscode] unknown shot key(s): ${unknown.join(', ')}`);
  console.error(`[vscode] known: ${Object.keys(SHOTS).join(', ')}`);
  process.exit(1);
}
const keys = wanted.length ? withChains(wanted) : ORDER;

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
// A pristine copy per run: the hot-reload shots rewrite a scene in it, and a
// previous run that died mid-edit must not seed this one's "before" shot.
rmSync(WS, { recursive: true, force: true });
cpSync(FIXTURES, WS, { recursive: true });
// The absolute user-data-dir: its basename is the same in every worktree, so it would kill a
// concurrent capture's dev-host in a sibling worktree.
const UD_MARKER = UD;
killStaleHost(UD_MARKER); // An aborted run can leave its host holding the dir.
await rmRetry(UD);
seedUserData(UD);
// The SIGKILL above is delivered, not awaited; a host still dying holds the port.
await sleep(500);
// A helper the dead host forked can outlive it holding the debugging socket,
// and it carries no user-data-dir for killStaleHost to match on.
killPortOrphan(PORT);
// A sibling worktree's dev-host is spared and can answer here. `waitCDP` accepts any 200 and
// `connectOverCDP` attaches to whatever answers, so the shots would show the wrong build.
await assertPortFree(PORT, 'VSCODE_CDP_PORT');

const { proc, launchFailed } = await launchDevHost();

const failed = [];
let browser;
try {
  await Promise.race([waitCDP(), launchFailed]);
  await sleep(5000); // Window settle.
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
      // One broken recipe must not cost the rest of the run.
      console.error(`[vscode]   FAILED: ${e.message}`);
      failed.push(key);
    }
  }
} catch (e) {
  console.error('[vscode] FAIL:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } catch { /* already gone */ }
  killProcessTree(proc);
  // A dev-host process that escaped the group, such as a re-parented Electron helper, still
  // carries the user-data-dir marker.
  killStaleHost(UD_MARKER);
}
if (failed.length) {
  console.error(`[vscode] ${failed.length} shot(s) did not reach their state: ${failed.join(', ')}`);
  process.exitCode = 1;
}
// waitCDP()'s poll loop, or a lost Promise.race branch on a failed launch, can keep the event
// loop alive after cleanup until the CDP timeout.
process.exit(process.exitCode ?? 0);
