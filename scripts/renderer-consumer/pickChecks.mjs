import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { pollInk } from './pollInk.mjs';
import { pixelsWhere } from '../vscode/pixels.mjs';
import { BAR_INK_FLOOR, CUBE_INK_FLOOR } from './switchFailures.mjs';
import { stillShot } from './stillShot.mjs';

/* global window */
// These exist only in the browser that runs the `page.evaluate` calls.

/** The green of `SelectionHighlight`, which nothing else in the pick scene draws. */
const isOutlineGreen = (r, g, b) => g > 180 && r < 80 && b < 80;

// A still shot, so a slow software frame has drawn the outline a click or an update changed.
const outlineOf = async (page) => pixelsWhere(await stillShot(page), isOutlineGreen);

const picksOf = (page) => page.evaluate(() => [...window.pickView.picks]);

/** The picks `onSelect` heard of a click at `centre` or `corner`, and the outline after it. */
async function clickAt(page, box, at) {
  const heard = (await picksOf(page)).length;
  const [x, y] = at === 'centre' ? [box.width / 2, box.height / 2] : [8, 8];
  // The view picks inside the pointer and click events, so `onSelect` has run when the click returns.
  await page.mouse.click(box.x + x, box.y + y);
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
  const box = await page.locator('#viewport').boundingBox();
  const unselected = await outlineOf(page);
  const onCube = await clickAt(page, box, 'centre');
  const onNothing = await clickAt(page, box, 'corner');
  await page.evaluate(() => {
    const { view, scene } = window.pickView;
    view.update({ selected: scene.getNode('Cube') });
  });
  const hostSelected = await outlineOf(page);
  const onNothingHostOwned = await clickAt(page, box, 'corner');
  await switchTo(page, '2D', BAR_INK_FLOOR);
  const on2D = await clickAt(page, box, 'centre');
  await switchTo(page, 'in-game', BAR_INK_FLOOR);
  const onInGame = await clickAt(page, box, 'centre');
  return {
    results: { unselected, onCube, onNothing, hostSelected, onNothingHostOwned, on2D, onInGame },
    errors: loggedErrors(diagnostics),
  };
}
