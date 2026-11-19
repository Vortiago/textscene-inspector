import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { RENDER_TIMEOUT_MS, pollInk } from './pollInk.mjs';
import { CUBE_INK_FLOOR, BAR_INK_FLOOR } from './switchFailures.mjs';
import { inkStats } from '../vscode/pixels.mjs';

/* global document, requestAnimationFrame, window */
// These exist only in the browser that runs the `page.evaluate` calls.

/** Software GL draws a frame in well under this, so two shots this far apart that match show a still view. */
const STILL_INTERVAL_MS = 1000;

const NO_WRITES = { isCubeShrunk: false, isBarGreen: false };
const BOTH_WRITES = { isCubeShrunk: true, isBarGreen: true };

/** A shot of `#viewport` once two shots in a row match, so the view has drawn what it will draw. */
async function stillShot(page) {
  const viewport = page.locator('#viewport');
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let shot = await viewport.screenshot();
  for (;;) {
    await page.waitForTimeout(STILL_INTERVAL_MS);
    const next = await viewport.screenshot();
    if (next.equals(shot) || Date.now() > deadline) return next;
    shot = next;
  }
}

/** The pixels in which a fresh view in `mode`, with `writes`, differs from `switched`. */
async function changedFromFresh(page, mode, writes, switched) {
  await page.evaluate(({ next, given }) => window.mountFresh(next, given), { next: mode, given: writes });
  if (mode === 'in-game') await page.evaluate(() => window.freshView.settled);
  return compareImages(await stillShot(page), switched).changedPixels;
}

/** Hides the 2D stage's rulers, axes and zoom buttons, which a capture leaves out, and the page shows. */
const STAGE_CHROME_HIDDEN = '#viewport div:not(:has(canvas)) { visibility: hidden !important; }';

/** The pixels in which the view's capture differs from what the page shows of it, or the two sizes. */
async function captureDelta(page) {
  const captured = Buffer.from(await page.evaluate(() => window.switchView.capture()), 'base64');
  const chrome = await page.addStyleTag({ content: STAGE_CHROME_HIDDEN });
  const shown = await page.locator('#viewport canvas').screenshot();
  await chrome.evaluate((style) => style.remove());
  const delta = compareImages(shown, captured);
  return delta.sizeMismatch ?? { changedPixels: delta.changedPixels, maxChannelDelta: delta.maxChannelDelta };
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

/** The ink before a write to a hidden view, once the hidden view settles, and once it shows again. */
async function writeWhileHidden(page) {
  const before = await pollInk(page, (drawn) => drawn >= CUBE_INK_FLOOR);
  await page.evaluate(async () => {
    const { view, shrinkCube } = window.switchView;
    view.update({ visible: false });
    await shrinkCube();
    await view.settled;
  });
  const hidden = await pollInk(page, () => true);
  // Two animation frames, so the shown view has drawn before the still shot reads it.
  await page.evaluate(() => {
    window.switchView.view.update({ visible: true });
    return new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn)));
  });
  const shown = inkStats(await stillShot(page)).inkPixels;
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
  const capturedVsShown = { '3D': await captureDelta(page) };
  const hiddenWrite = await writeWhileHidden(page);
  await page.evaluate(() => window.switchView.recolourBar());
  const editor2D = await switchTo(page, '2D', BAR_INK_FLOOR);
  shots['2D'] = await stillShot(page);
  capturedVsShown['2D'] = await captureDelta(page);
  const backInGame = await switchTo(page, 'in-game', CUBE_INK_FLOOR);
  await page.evaluate(() => window.switchView.view.settled);
  shots['in-game'] = await stillShot(page);
  capturedVsShown['in-game'] = await captureDelta(page);
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
      capturedVsShown,
    },
    errors: loggedErrors(diagnostics),
  };
}
