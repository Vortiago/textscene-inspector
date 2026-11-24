import { settleCanvas } from '../visual/previewServer.mjs';
import { FRAME_ON_OPEN_STORAGE_KEY } from '../visual/preview/appContract.mjs';
import { expandAllTreeRows, SELECT_SETTLE_MS, selectOutlinerNode } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { INSTANCE_CLICK_FIXTURE, redPixels } from './instanceClickScenario.mjs';

// The fixture's two boxes span 3 units across and 1 up, so the root is wider than it is tall.
const FRAMED = 'Root';
/** With the widest dock, a canvas about 0.4 as wide as it is tall. */
const TALL_VIEWPORT = { width: 1280, height: 1800 };
const WIDEST_DOCK_PX = 560;
export const FRAME_ON_OPEN_FIXTURE = 'unit-frame-on-open.tscn';
// The fit timers end at 1,100 ms, so a frame on open has landed by then.
const FRAME_ON_OPEN_SETTLE_MS = 1500;

/* global window */ // An init script runs in the browser.
const setStorage = ([key, value]) => window.localStorage.setItem(key, value);

/** The span of red across the canvas, as fractions of its width, or null for no red pixel. */
function redSpan(buffer, width) {
  const { red, minX, maxX } = redPixels(buffer);
  return red.length === 0 ? null : { left: minX / width, right: (maxX + 1) / width };
}

async function runOrthographicFocus(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: INSTANCE_CLICK_FIXTURE,
    label: 'frame fit orthographic',
    viewport: TALL_VIEWPORT,
    initScripts: [[setStorage, ['tsi.dockWidth', String(WIDEST_DOCK_PX)]]],
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  await selectOutlinerNode(page, FRAMED);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Numpad5');
  await page.waitForTimeout(SELECT_SETTLE_MS);
  await page.keyboard.press('f');
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const span = redSpan(await canvas.screenshot(), box.width);
  await context.close();
  return { span, aspect: box.width / box.height, diagnostics };
}

async function openedSpan(browser, baseUrl, isFramedOnOpen) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FRAME_ON_OPEN_FIXTURE,
    label: `frame fit open ${isFramedOnOpen ? 'framed' : 'unframed'}`,
    initScripts: [[setStorage, [FRAME_ON_OPEN_STORAGE_KEY, String(isFramedOnOpen)]]],
  });
  await settleCanvas(page, canvas);
  await page.waitForTimeout(FRAME_ON_OPEN_SETTLE_MS);
  const { width } = await canvas.boundingBox();
  const span = redSpan(await canvas.screenshot(), width);
  await context.close();
  return { span, diagnostics };
}

export async function runFrameFitScenario(browser, baseUrl) {
  return {
    orthographic: await runOrthographicFocus(browser, baseUrl),
    unframed: await openedSpan(browser, baseUrl, false),
    framed: await openedSpan(browser, baseUrl, true),
  };
}

// A cut box runs to the edge but for its anti-aliased last pixel, about 0.003 of this width.
const EDGE_FRACTION = 0.02;

/** How far the red span's middle sits from the canvas middle, as a fraction of the width. 1 for no red. */
const offCentre = (span) => (span ? Math.abs((span.left + span.right) / 2 - 0.5) : 1);
// A frame centres the box. Godot's fixed orbit leaves it 6 units to the side.
const CENTRED_FRACTION = 0.05;

/** Records the scenario's claims on `gate`. */
export function checkFrameFit(gate, { orthographic, unframed, framed }) {
  checkDiagnostics(gate, '[frame fit orthographic]', orthographic.diagnostics);
  checkDiagnostics(gate, '[frame fit open unframed]', unframed.diagnostics);
  checkDiagnostics(gate, '[frame fit open framed]', framed.diagnostics);
  const { span } = orthographic;
  gate.check(
    !!span && span.left > EDGE_FRACTION && span.right < 1 - EDGE_FRACTION,
    `[frame fit] F in an orthographic view of aspect ${orthographic.aspect.toFixed(2)} cut ${FRAMED} at the ` +
      `canvas edge: red from ${span?.left} to ${span?.right} of the width`
  );
  gate.check(
    offCentre(framed.span) < CENTRED_FRACTION,
    `[frame fit] frame on open left the box ${offCentre(framed.span)} of the width off the middle`
  );
  gate.check(
    offCentre(unframed.span) >= CENTRED_FRACTION,
    `[frame fit] the box sat in the middle at Godot's fixed orbit too, so the frame on open check proves nothing`
  );
}

export function measureFrameFit({ orthographic, unframed, framed }) {
  return (
    `frame fit  orthographic aspect=${orthographic.aspect.toFixed(2)} span=${JSON.stringify(orthographic.span)} | ` +
    `open unframed=${JSON.stringify(unframed.span)} framed=${JSON.stringify(framed.span)}`
  );
}
