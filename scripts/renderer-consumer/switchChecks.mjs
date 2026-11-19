import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { pollInk } from './pollInk.mjs';
import { CUBE_INK_FLOOR, BAR_INK_FLOOR, SHRUNK_INK_DROP } from './switchFailures.mjs';

/* global document, window */
// These exist only in the browser that runs the `page.evaluate` calls.

/** Long enough for a frame loop that still ran to draw the write. */
const HIDDEN_WAIT_MS = 3000;

/** Switches the view to `mode`, and answers what the element holds after it. */
async function switchTo(page, mode, inkFloor) {
  await page.evaluate((next) => {
    window.replacedContext = document.querySelector('#viewport canvas').getContext('webgl2');
    window.switchView.view.update({ mode: next });
  }, mode);
  const ink = await pollInk(page, (drawn) => drawn >= inkFloor);
  const isReplacedContextLost = await page
    .waitForFunction(() => window.replacedContext.isContextLost(), null, { timeout: 10_000 })
    .then(
      () => true,
      () => false
    );
  const canvases = await page.evaluate(() => document.querySelectorAll('#viewport canvas').length);
  return { ink, canvases, isReplacedContextLost };
}

/** The bytes of a PNG captured while the view is hidden, or the message of its rejection. */
function captureWhileHidden(page) {
  return page.evaluate(async () => {
    const { view } = window.switchView;
    view.update({ visible: false });
    try {
      return (await view.captureImage()).size;
    } catch (error) {
      return error.message;
    } finally {
      view.update({ visible: true });
    }
  });
}

/** The ink before a write to a hidden view, while it stays hidden, and once it shows again. */
async function writeWhileHidden(page) {
  const before = await pollInk(page, (drawn) => drawn >= CUBE_INK_FLOOR);
  await page.evaluate(() => {
    window.switchView.view.update({ visible: false });
    return window.switchView.shrinkCube();
  });
  await page.waitForTimeout(HIDDEN_WAIT_MS);
  const hidden = await pollInk(page, () => true);
  await page.evaluate(() => window.switchView.view.update({ visible: true }));
  const shown = await pollInk(page, (drawn) => drawn <= before - SHRUNK_INK_DROP);
  return { before, hidden, shown };
}

export async function runSwitchChecks(page, url) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  await page.waitForFunction(() => window.switchView);
  await page.evaluate(() => window.switchView.view.settled);
  const inGameInk = await pollInk(page, (drawn) => drawn >= CUBE_INK_FLOOR);
  const hiddenCapture = await captureWhileHidden(page);
  const editor3D = await switchTo(page, '3D', CUBE_INK_FLOOR);
  const hiddenWrite = await writeWhileHidden(page);
  const editor2D = await switchTo(page, '2D', BAR_INK_FLOOR);
  await page.evaluate(() => window.switchView.view.dispose());
  return {
    results: { inGameInk, hiddenCapture, modes: { '3D': editor3D, '2D': editor2D }, hiddenWrite },
    errors: loggedErrors(diagnostics),
  };
}
