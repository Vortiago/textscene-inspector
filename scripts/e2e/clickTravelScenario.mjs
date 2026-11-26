import { settleCanvas } from '../visual/previewServer.mjs';
import { readSelectedPaths, SELECT_SETTLE_MS } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { INSTANCE_CLICK_FIXTURE, LOCKED_PICK, OPEN_PICK, redBoxCentres } from './instanceClickScenario.mjs';

export const CLICK_TRAVEL_FIXTURE = INSTANCE_CLICK_FIXTURE;
// A press and release at most 8 px apart is a click (node_3d_editor_plugin.cpp:2342).
export const CLICK_TRAVEL_PX = 8;
// Past the click travel a left press and release is a drag, which picks and clears nothing.
const DRAG_TRAVEL_PX = 20;
// The fixture's boxes sit in the middle, so a corner of the canvas shows only the background.
const EMPTY_SPOT = { x: 12, y: 12 };

/** A left press at `from`, a move through each of `travels` px to the right, and a release at the last. */
async function pressAlong(page, canvas, from, travels, { alt = false } = {}) {
  const box = await canvas.boundingBox();
  const x = box.x + from.x;
  const y = box.y + from.y;
  await page.mouse.move(x, y);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  for (const travel of travels) await page.mouse.move(x + travel, y, { steps: 4 });
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return readSelectedPaths(page);
}

const dragBy = (page, canvas, from, travel) => pressAlong(page, canvas, from, [travel]);

export async function runClickTravelScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: CLICK_TRAVEL_FIXTURE,
    label: 'click travel',
  });
  await settleCanvas(page, canvas);
  const centres = redBoxCentres(await canvas.screenshot());
  const run = { centres, diagnostics };
  if (centres) {
    run.onBox = await dragBy(page, canvas, centres.right, 0);
    run.onNothing = await dragBy(page, canvas, EMPTY_SPOT, CLICK_TRAVEL_PX);
    run.onOtherBox = await dragBy(page, canvas, centres.left, CLICK_TRAVEL_PX);
    run.dragOnNothing = await dragBy(page, canvas, EMPTY_SPOT, DRAG_TRAVEL_PX);
    run.dragBackOnBox = await pressAlong(page, canvas, centres.right, [DRAG_TRAVEL_PX, 0]);
    run.altClickOnBox = await pressAlong(page, canvas, centres.right, [0], { alt: true });
  }
  await context.close();
  return run;
}

const listOf = (paths) => `[${paths?.join(', ')}]`;

function checkSelection(gate, what, found, expected) {
  gate.check(
    JSON.stringify(found) === JSON.stringify(expected),
    `[click travel] ${what} selects ${listOf(found)}, expected ${listOf(expected)}`
  );
}

export function checkClickTravel(
  gate,
  { centres, onBox, onNothing, onOtherBox, dragOnNothing, dragBackOnBox, altClickOnBox, diagnostics }
) {
  checkDiagnostics(gate, '[click travel]', diagnostics);
  gate.check(!!centres, '[click travel] the view draws no red box, so no click was made');
  if (!centres) return;
  checkSelection(gate, 'a click on a box', onBox, [OPEN_PICK]);
  checkSelection(gate, `a click on nothing that moves ${CLICK_TRAVEL_PX} px`, onNothing, []);
  checkSelection(gate, `a click on a box that moves ${CLICK_TRAVEL_PX} px`, onOtherBox, [LOCKED_PICK]);
  checkSelection(gate, `a drag of ${DRAG_TRAVEL_PX} px from nothing`, dragOnNothing, [LOCKED_PICK]);
  checkSelection(gate, `a drag of ${DRAG_TRAVEL_PX} px from a box and back`, dragBackOnBox, [LOCKED_PICK]);
  checkSelection(gate, 'an Alt click on a box', altClickOnBox, [LOCKED_PICK]);
}

export const measureClickTravel = ({
  onBox,
  onNothing,
  onOtherBox,
  dragOnNothing,
  dragBackOnBox,
  altClickOnBox,
}) =>
  `click travel  box: ${listOf(onBox)} | nothing ${CLICK_TRAVEL_PX} px: ${listOf(onNothing)} | ` +
  `box ${CLICK_TRAVEL_PX} px: ${listOf(onOtherBox)} | drag: ${listOf(dragOnNothing)} | ` +
  `drag back: ${listOf(dragBackOnBox)} | alt: ${listOf(altClickOnBox)}`;
