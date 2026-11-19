import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { pollInk } from './pollInk.mjs';
import { stillShot } from './stillShot.mjs';
import { CUBE_INK_FLOOR, BAR_INK_FLOOR, SHRUNK_INK_DROP } from './switchFailures.mjs';

/* global document, window */
// These exist only in the browser that runs the `page.evaluate` calls.

/** Long enough for a frame loop that still ran to draw the write. */
const HIDDEN_WAIT_MS = 3000;

const NO_WRITES = { isCubeShrunk: false, isBarGreen: false };
const BOTH_WRITES = { isCubeShrunk: true, isBarGreen: true };

/** The pixels in which a fresh view in `mode`, with `writes`, differs from `switched`. */
async function changedFromFresh(page, mode, writes, switched) {
  await page.evaluate(({ next, given }) => window.mountFresh(next, given), { next: mode, given: writes });
  if (mode === 'in-game') await page.evaluate(() => window.freshView.settled);
  return compareImages(await stillShot(page), switched).changedPixels;
}

/** Switches the view to `mode`, and answers what the element holds after it. */
async function switchTo(page, mode, inkFloor) {
  // `update` commits at once, so the replaced canvas has left and lost its context when it returns.
  const isReplacedContextLost = await page.evaluate((next) => {
    const replaced = document.querySelector('#viewport canvas').getContext('webgl2');
    window.switchView.view.update({ mode: next });
    return replaced.isContextLost();
  }, mode);
  const ink = await pollInk(page, (drawn) => drawn >= inkFloor);
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
  const firstInGame = await stillShot(page);
  const hiddenCapture = await captureWhileHidden(page);
  const editor3D = await switchTo(page, '3D', CUBE_INK_FLOOR);
  const shots = { '3D': await stillShot(page) };
  const hiddenWrite = await writeWhileHidden(page);
  await page.evaluate(() => window.switchView.recolourBar());
  const editor2D = await switchTo(page, '2D', BAR_INK_FLOOR);
  shots['2D'] = await stillShot(page);
  const backInGame = await switchTo(page, 'in-game', CUBE_INK_FLOOR);
  await page.evaluate(() => window.switchView.view.settled);
  shots['in-game'] = await stillShot(page);
  const changedFromFirstInGame = compareImages(firstInGame, shots['in-game']).changedPixels;
  const changedFromFreshMount = {
    '3D': await changedFromFresh(page, '3D', NO_WRITES, shots['3D']),
    '2D': await changedFromFresh(page, '2D', BOTH_WRITES, shots['2D']),
    'in-game': await changedFromFresh(page, 'in-game', BOTH_WRITES, shots['in-game']),
  };
  await page.evaluate(() => window.freshView.dispose());
  return {
    results: {
      inGameInk,
      hiddenCapture,
      modes: { '3D': editor3D, '2D': editor2D, 'in-game': backInGame },
      hiddenWrite,
      changedFromFreshMount,
      changedFromFirstInGame,
    },
    errors: loggedErrors(diagnostics),
  };
}
