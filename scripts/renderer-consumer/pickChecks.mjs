import { PNG } from 'pngjs';
import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { pollInk } from './pollInk.mjs';
import { BAR_INK_FLOOR, CUBE_INK_FLOOR } from './switchFailures.mjs';

/* global window */
// It exists only in the browser that runs the `page.evaluate` calls.

/** Software GL draws a frame in well under this, so a click it has not heard by then picked nothing. */
const PICK_WAIT_MS = 1500;

/** The green of `SelectionHighlight`, which nothing else in the pick scene draws. */
function outlinePixels(png) {
  const { data } = PNG.sync.read(png);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] > 180 && data[i] < 80 && data[i + 2] < 80) count++;
  }
  return count;
}

const outlineOf = async (page) => outlinePixels(await page.locator('#viewport').screenshot());

const picksOf = (page) => page.evaluate(() => [...window.pickView.picks]);

/** The picks `onSelect` heard after a click at `at` of the element: `centre` or `corner`. */
async function clickAt(page, at) {
  const box = await page.locator('#viewport').boundingBox();
  const heard = (await picksOf(page)).length;
  const [x, y] = at === 'centre' ? [box.width / 2, box.height / 2] : [8, 8];
  await page.mouse.click(box.x + x, box.y + y);
  await page
    .waitForFunction((count) => window.pickView.picks.length > count, heard, { timeout: PICK_WAIT_MS })
    .catch(() => {
      // A click in a mode that picks nothing calls no onSelect: the wait ends with no new pick.
    });
  // Two frames, so the outline the click changed has drawn before the shot.
  await page.waitForTimeout(500);
  return { picks: (await picksOf(page)).slice(heard), outline: await outlineOf(page) };
}

async function switchTo(page, mode, inkFloor) {
  await page.evaluate((next) => window.pickView.view.update({ mode: next }), mode);
  await pollInk(page, (drawn) => drawn >= inkFloor);
}

/** Each click on the 3D, 2D and In-game modes, what `onSelect` heard of it, and the outline after it. */
export async function runPickChecks(page, url) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  await page.waitForFunction(() => window.pickView);
  await page.evaluate(() => window.pickView.view.settled);
  await pollInk(page, (drawn) => drawn >= CUBE_INK_FLOOR);
  const unselected = await outlineOf(page);
  const onCube = await clickAt(page, 'centre');
  const onNothing = await clickAt(page, 'corner');
  await page.evaluate(() => {
    const { view, scene } = window.pickView;
    view.update({ selected: scene.getNode('Cube') });
  });
  await page.waitForTimeout(500);
  const hostSelected = await outlineOf(page);
  const onNothingHostOwned = await clickAt(page, 'corner');
  await switchTo(page, '2D', BAR_INK_FLOOR);
  const on2D = await clickAt(page, 'centre');
  await switchTo(page, 'in-game', BAR_INK_FLOOR);
  const onInGame = await clickAt(page, 'centre');
  return {
    results: { unselected, onCube, onNothing, hostSelected, onNothingHostOwned, on2D, onInGame },
    errors: loggedErrors(diagnostics),
  };
}
