import { settleCanvas } from '../visual/previewServer.mjs';
import { readSelectedPaths, SELECT_SETTLE_MS } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { INSTANCE_CLICK_FIXTURE, LOCKED_PICK, OPEN_PICK, redBoxCentres } from './instanceClickScenario.mjs';

export const CLICK_TRAVEL_FIXTURE = INSTANCE_CLICK_FIXTURE;
// A press and release at most 8 px apart is a click (node_3d_editor_plugin.cpp:2342).
export const CLICK_TRAVEL_PX = 8;
// Past the click travel a left drag orbits the previewer's camera, so it picks and clears nothing.
const ORBIT_TRAVEL_PX = 20;
// The fixture's boxes sit in the middle, so a corner of the canvas shows only the background.
const EMPTY_SPOT = { x: 12, y: 12 };

/** A left press at `from` and a release `travel` px to the right of it, on the canvas. */
async function dragBy(page, canvas, from, travel) {
  const box = await canvas.boundingBox();
  const x = box.x + from.x;
  const y = box.y + from.y;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + travel, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return readSelectedPaths(page);
}

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
    run.orbitOnNothing = await dragBy(page, canvas, EMPTY_SPOT, ORBIT_TRAVEL_PX);
  }
  await context.close();
  return run;
}

const listOf = (paths) => `[${paths?.join(', ')}]`;

function checkSelection(gate, what, found, expected) {
  gate.check(
    found?.length === expected.length && expected.every((path, i) => found[i] === path),
    `[click travel] ${what} selects ${listOf(found)}, expected ${listOf(expected)}`
  );
}

export function checkClickTravel(
  gate,
  { centres, onBox, onNothing, onOtherBox, orbitOnNothing, diagnostics }
) {
  checkDiagnostics(gate, '[click travel]', diagnostics);
  gate.check(!!centres, '[click travel] the view draws no red box, so no click was made');
  if (!centres) return;
  checkSelection(gate, 'a click on a box', onBox, [OPEN_PICK]);
  checkSelection(gate, `a click on nothing that moves ${CLICK_TRAVEL_PX} px`, onNothing, []);
  checkSelection(gate, `a click on a box that moves ${CLICK_TRAVEL_PX} px`, onOtherBox, [LOCKED_PICK]);
  checkSelection(gate, `an orbit of ${ORBIT_TRAVEL_PX} px from nothing`, orbitOnNothing, [LOCKED_PICK]);
}

export const measureClickTravel = ({ onBox, onNothing, onOtherBox, orbitOnNothing }) =>
  `click travel  box: ${listOf(onBox)} | nothing ${CLICK_TRAVEL_PX} px: ${listOf(onNothing)} | ` +
  `box ${CLICK_TRAVEL_PX} px: ${listOf(onOtherBox)} | orbit: ${listOf(orbitOnNothing)}`;
