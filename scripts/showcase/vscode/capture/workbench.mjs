/**
 * Driving the running workbench: find its page, run palette commands, open a
 * file, and wait for OUR previewer's canvas to actually paint before shooting.
 *
 * Everything here is keyboard-driven through the command palette, because the
 * subject of the shot is the webview and a mouse-driven menu would be in it.
 */
/* global document */ // `document` appears only inside page.frames().evaluate() callbacks, which run in the browser.

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

/** Run a command-palette command by its visible label. */
export async function palette(page, label) {
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

/** Open the scene's preview alone in the editor area and screenshot the window. */
export async function captureSceneShot(page, key, scene) {
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
