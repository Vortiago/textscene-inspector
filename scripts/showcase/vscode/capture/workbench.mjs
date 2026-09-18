/**
 * Driving the running workbench: find its page, run palette commands, open
 * files, reach into a preview webview, and wait for OUR previewer's canvas to
 * actually paint before shooting.
 *
 * Everything here is keyboard-driven through the command palette, because the
 * subject of the shot is the webview and a mouse-driven menu would be in it.
 */
/* global document */ // `document` appears only inside frame.evaluate() callbacks, which run in the browser.

// Workbench parts are addressed by their stable ids rather than by class: the
// `.part.sidebar` spelling also matches a hidden part, so a visibility test
// against it answers for the wrong element.
const SIDE_BAR = '[id="workbench.parts.sidebar"]';
const STATUS_BAR = '[id="workbench.parts.statusbar"]';
const EDITOR_PART = '[id="workbench.parts.editor"]';

import { sleep } from './platform.mjs';
import { OUT } from './paths.mjs';

/** The workbench page of a CDP-connected dev-host, focused and (optionally) logging. */
export async function workbenchPage(browser) {
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /workbench/.test(p.url())) ?? ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  if (process.env.VSC_DEBUG) {
    const attach = (p) => {
      p.on('console', (m) => { const t = m.text(); if (/error|fail|glb|resource|scene|not text|denied|csp|worker/i.test(t) && !/Extension Host|lock file|SSE_PORT/.test(t)) console.log('  [console]', t.slice(0, 240)); });
      p.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 240)));
    };
    ctx.on('page', attach);
    ctx.pages().forEach(attach);
  }
  return page;
}

/**
 * Move keyboard focus out of a preview webview and back to the workbench.
 *
 * A webview is an iframe, and VS Code's keybinding service never sees a key
 * pressed while it holds focus — so the palette silently stops opening and
 * every command after it is a no-op that still reports success. Clicking the
 * middle of the status bar is the cheapest way back: nothing lives there, so
 * the click changes no state.
 */
async function focusWorkbench(page) {
  const box = await page.locator(STATUS_BAR).first().boundingBox().catch(() => null);
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(200);
}

/** Run a command-palette command by its visible label. */
export async function palette(page, label) {
  await focusWorkbench(page);
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
export async function openFile(page, relPath) {
  await focusWorkbench(page);
  await page.keyboard.press('Escape');
  await sleep(150);
  await page.keyboard.press('Control+P');
  await sleep(500);
  await page.keyboard.type(relPath, { delay: 8 });
  await sleep(900);
  await page.keyboard.press('Enter');
  await sleep(900);
}

export const closeAllEditors = (page) => palette(page, 'View: Close All Editors');
export const openPreview = (page) => palette(page, 'TextScene: Open Preview to the Side');
/** Drop the raw .tscn source so the webview fills the editor area. */
export const soloPreview = (page) => palette(page, 'View: Close Editors in Other Groups');

/**
 * Give the preview group `fraction` of the editor area by dragging the sash.
 *
 * Below 768px the shell stacks its dock under the viewport
 * (`TscnPreviewShell.module.css`), and the stacked dock falls outside the
 * visible area — so an evenly split 1440px window shows a preview with no
 * scene tree at all. Electron exposes no `Browser.setWindowBounds`, and under
 * xvfb there is no window manager to resize against, so the split itself is the
 * only lever. Dragging the sash is also what a reader would do.
 */
export async function widenPreview(page, fraction = 0.62) {
  const editor = await page.locator(EDITOR_PART).first().boundingBox();
  const sash = page.locator(`${EDITOR_PART} .monaco-sash.vertical`).first();
  const box = await sash.boundingBox().catch(() => null);
  if (!editor || !box) return; // a single group has no sash to drag
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(editor.x + editor.width * (1 - fraction), y, { steps: 12 });
  await page.mouse.up();
  await sleep(1200); // webview relayout
}

/**
 * Close one editor tab by its exact label.
 *
 * `View: Close Editor` acts on whichever editor the workbench thinks is active,
 * which is not reliably the one a recipe just opened. Naming the tab is exact,
 * so `unit-box-mesh.tscn` never takes `Preview: unit-box-mesh.tscn` with it.
 */
export async function closeTab(page, label) {
  const tab = page.locator(`.tab:has(.label-name:text-is("${label}"))`).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.hover();
  await tab.locator('.codicon-close').first().click();
  await sleep(800);
}

/** Show or hide the Explorer side bar, whichever the shot needs. */
export async function setSideBar(page, visible) {
  // Width, not `isVisible`: a hidden part stays in the DOM with a zero-width box.
  const box = await page.locator(SIDE_BAR).first().boundingBox().catch(() => null);
  const shown = Boolean(box && box.width > 0);
  if (shown !== visible) await palette(page, 'View: Toggle Primary Side Bar Visibility');
  await sleep(700);
}

/** Every frame currently carrying the previewer's React root. */
export async function previewFrames(page) {
  const found = [];
  for (const frame of page.frames()) {
    const has = await frame
      .evaluate(() => Boolean(document.getElementById('r3f-root')))
      .catch(() => false); // cross-origin / detached frame
    if (has) found.push(frame);
  }
  return found;
}

/**
 * The preview frame whose scene tree holds `nodeName`.
 *
 * Frames are addressed by CONTENT, never by their order in `page.frames()`:
 * that order follows attach time, so the two-panel shots would pick left and
 * right at random and the captions would be wrong half the time.
 */
export async function frameShowing(page, nodeName) {
  for (const frame of await previewFrames(page)) {
    await expandTree(frame); // a collapsed row is not in the DOM to match against
    const has = await frame
      .evaluate((n) => Boolean(document.querySelector(`[data-node-path$="/${n}"], [data-node-path="${n}"]`)), nodeName)
      .catch(() => false);
    if (has) return frame;
  }
  throw new Error(`no preview frame showing a node named "${nodeName}"`);
}

/** Expand the scene tree in every open preview, so each shot shows its hierarchy. */
export async function expandAllTrees(page) {
  for (const frame of await previewFrames(page)) await expandTree(frame);
}

/** Expand every scene-tree row, so a deep node is reachable and the shot shows the hierarchy. */
export async function expandTree(frame) {
  await frame.evaluate(() => document.querySelector('[aria-label="Expand all"]')?.click());
  await sleep(600);
}

/** Click a scene-tree row by its node path (`Root/Box`), selecting it. */
export async function selectNode(frame, nodePath) {
  await expandTree(frame);
  const clicked = await frame.evaluate((p) => {
    const row = document.querySelector(`[data-node-path="${p}"] [role="treeitem"]`);
    if (!row) return false;
    row.click();
    return true;
  }, nodePath);
  if (!clicked) throw new Error(`no scene-tree row at "${nodePath}"`);
  await sleep(900); // details panel repaint
}

/** Poll every frame for the previewer's #r3f-root canvas being painted. */
export async function waitForCanvas(page, timeoutMs = 30000) {
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

/**
 * Open a scene's preview and leave the editor area in the requested shape.
 *
 * `split` keeps the .tscn source beside the webview (the flows whose subject is
 * the source-to-preview pairing); the default closes it so the webview fills
 * the window.
 */
export async function openScenePreview(page, file, { split = false, sideBar = true, previewShare = 0 } = {}) {
  await setSideBar(page, sideBar);
  await closeAllEditors(page);
  await openFile(page, file);
  await openPreview(page);
  await sleep(1500);
  if (!split) await soloPreview(page);
  let painted = await waitForCanvas(page);
  if (!painted) {
    // Cold-start race: on the FIRST .tscn the extension may still be
    // activating when the preview command runs, so it no-ops and the editor
    // stays on the welcome page. Retry once now that activation has completed.
    console.log('[vscode]   no canvas yet — retrying preview after activation…');
    await openFile(page, file);
    await openPreview(page);
    await sleep(1500);
    if (!split) await soloPreview(page);
    painted = await waitForCanvas(page);
  }
  if (previewShare) await widenPreview(page, previewShare);
  return painted;
}

/** Settle: GLBs + textures stream over the webview base64 bridge after first paint. */
export const settle = (ms = 9000) => sleep(ms);

/** Write the window to `<key>.png`, reporting whether a canvas ever painted. */
export async function shoot(page, key, painted = true) {
  const path = `${OUT}/${key}.png`;
  await page.screenshot({ path });
  console.log(`[vscode]   ${painted ? 'canvas painted' : 'TIMEOUT (no canvas)'} → ${path}`);
  return painted;
}
