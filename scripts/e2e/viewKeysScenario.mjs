import { settleCanvas } from '../visual/previewServer.mjs';
import { expandAllTreeRows, SELECT_SETTLE_MS, selectOutlinerNode, treeRow } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { INSTANCE_CLICK_FIXTURE, redBoxCentres, redPixels } from './instanceClickScenario.mjs';
import { FIXTURE_2D } from './editorViewScenarios.mjs';

const FOCUSED_3D = 'Root/Open';
const FOCUSED_2D = 'World/Right';
/** `World/Right` sits at (576 + 140, 324) on the canvas of unit-sprite2d.tscn. */
const RIGHT_ON_CANVAS = { x: 716, y: 324 };

async function pointAtCentre(page, element) {
  const box = await element.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function boxesAfterKey(page, canvas, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return redBoxCentres(await canvas.screenshot());
}

/** The middle of the red span across the frame, or null for no red pixel. A framed box fills the span. */
function redSpanMiddle(buffer) {
  const { red, minX, maxX } = redPixels(buffer);
  return red.length === 0 ? null : (minX + maxX) / 2;
}

async function run3D(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: INSTANCE_CLICK_FIXTURE,
    label: 'view keys 3D',
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  await selectOutlinerNode(page, FOCUSED_3D);
  await page.mouse.move(0, 0);
  // The tree row holds focus and the pointer never entered the view, so the page's F frames nothing.
  const opened = redBoxCentres(await canvas.screenshot());
  const fromPage = await boxesAfterKey(page, canvas, 'f');
  await pointAtCentre(page, canvas);
  const framed = await boxesAfterKey(page, canvas, 'f');
  const framedMiddle = redSpanMiddle(await canvas.screenshot());
  const origin = await boxesAfterKey(page, canvas, 'o');
  // The view holds focus. A hovered row takes it, so F frames nothing while the row is hovered.
  await treeRow(page, 'Root/Locked').hover();
  const whileHovered = await boxesAfterKey(page, canvas, 'f');
  const width = (await canvas.boundingBox()).width;
  await context.close();
  return { opened, fromPage, framed, framedMiddle, origin, whileHovered, width, diagnostics };
}

const panOf = (frame) =>
  frame.evaluate((el) => {
    const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(el.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) } : null;
  });

async function run2D(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_2D,
    label: 'view keys 2D',
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  await selectOutlinerNode(page, FOCUSED_2D);
  const stage = page.getByTestId('canvas-2d-stage');
  const frame = page.getByTestId('canvas-2d-frame');
  await pointAtCentre(page, stage);
  const panAfterKey = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(SELECT_SETTLE_MS);
    return panOf(frame);
  };
  const before = await panOf(frame);
  const centred = await panAfterKey('f');
  const framed = await panAfterKey('Shift+F');
  const box = await stage.boundingBox();
  await context.close();
  return { before, centred, framed, stage: { width: box.width, height: box.height }, diagnostics };
}

export async function runViewKeysScenario(browser, baseUrl) {
  return { threeD: await run3D(browser, baseUrl), twoD: await run2D(browser, baseUrl) };
}

// The outline of a hovered row moves the red centre by a pixel, a frame by tens of pixels.
const BOX_TOLERANCE_PX = 2;
const near = (a, b) => Math.abs(a.x - b.x) <= BOX_TOLERANCE_PX && Math.abs(a.y - b.y) <= BOX_TOLERANCE_PX;
const sameBoxes = (a, b) => (a && b ? near(a.left, b.left) && near(a.right, b.right) : a === b);

/** Where the canvas point lands on the stage under `view`. */
const onStage = (view, point) => ({ x: view.x + point.x * view.zoom, y: view.y + point.y * view.zoom });

/** Records the scenario's claims on `gate`. */
export function checkViewKeys(gate, { threeD, twoD }) {
  checkDiagnostics(gate, '[view keys 3D]', threeD.diagnostics);
  checkDiagnostics(gate, '[view keys 2D]', twoD.diagnostics);
  gate.check(
    sameBoxes(threeD.opened, threeD.fromPage),
    `[view keys] an F outside the view moved it: ${JSON.stringify(threeD.opened)} to ${JSON.stringify(threeD.fromPage)}`
  );
  const middle = threeD.width / 2;
  gate.check(
    !!threeD.framed && !sameBoxes(threeD.opened, threeD.framed),
    `[view keys] F in the view did not frame ${FOCUSED_3D}: ${JSON.stringify(threeD.framed)}`
  );
  gate.check(
    threeD.framedMiddle !== null && Math.abs(threeD.framedMiddle - middle) < threeD.width * 0.1,
    `[view keys] F left ${FOCUSED_3D} at x ${threeD.framedMiddle}, expected near the middle, ${middle}`
  );
  gate.check(
    !!threeD.origin && !sameBoxes(threeD.framed, threeD.origin),
    `[view keys] O did not move the view off ${FOCUSED_3D}: ${JSON.stringify(threeD.origin)}`
  );
  gate.check(
    sameBoxes(threeD.origin, threeD.whileHovered),
    `[view keys] F framed a hovered row: ${JSON.stringify(threeD.origin)} to ${JSON.stringify(threeD.whileHovered)}`
  );
  const { before, centred, framed, stage } = twoD;
  const centre = centred && onStage(centred, RIGHT_ON_CANVAS);
  gate.check(
    !!centre &&
      Math.abs(centre.x - stage.width / 2) <= centred.zoom &&
      Math.abs(centre.y - stage.height / 2) <= centred.zoom,
    `[view keys] F put ${FOCUSED_2D} at ${JSON.stringify(centre)} on a ${stage.width}x${stage.height} stage, expected its centre`
  );
  gate.check(
    !!before && !!centred && before.x !== centred.x,
    `[view keys] F did not move the 2D view: ${JSON.stringify(before)} to ${JSON.stringify(centred)}`
  );
  gate.check(
    !!framed && !!centred && framed.zoom > centred.zoom,
    `[view keys] Shift+F did not zoom in on ${FOCUSED_2D}: ${centred?.zoom} to ${framed?.zoom}`
  );
}

export function measureViewKeys({ threeD, twoD }) {
  return (
    `view keys  3D framed middle=${threeD.framedMiddle} of ${threeD.width} origin=${JSON.stringify(threeD.origin)} | ` +
    `2D before=${JSON.stringify(twoD.before)} centred=${JSON.stringify(twoD.centred)} framed=${JSON.stringify(twoD.framed)}`
  );
}
