import { PNG } from 'pngjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture, shootCanvas } from './openFixture.mjs';
import { redPixels } from './instanceClickScenario.mjs';

export const CAMERA_FRAME_2D_FIXTURE = 'unit-camera2d-frame-view.tscn';
// The square is 100 px across and the camera's zoom is 2, so its frame draws the square 200 px across.
export const FRAMED_SQUARE_PX = 200;
// A frame centres the camera's view on the stage: the square, which the camera centres, lands there too.
export const CENTRE_TOLERANCE_PX = 3;
const SIZE_TOLERANCE_PX = 3;
// The frame lands a render after the click, and the 2D stage draws it on its next frame.
const FRAME_SETTLE_MS = 500;

/** The red square's box in a shot of the canvas, and the shot's size, or a null box for no red pixel. */
async function redBox(page) {
  const buffer = await shootCanvas(page, 'camera frame 2D');
  const { red, minX, maxX } = redPixels(buffer);
  const { width, height } = PNG.sync.read(buffer);
  if (red.length === 0) return { box: null, width, height };
  const ys = red.map(([, y]) => y);
  const minY = ys.reduce((lo, y) => Math.min(lo, y), Infinity);
  const maxY = ys.reduce((hi, y) => Math.max(hi, y), -Infinity);
  return { box: { left: minX, top: minY, width: maxX + 1 - minX, height: maxY + 1 - minY }, width, height };
}

/** Opens a 2D scene, then clicks the Camera2D's "2D · frame view" row in the Cameras tab. */
export async function runCameraFrame2DScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: CAMERA_FRAME_2D_FIXTURE,
    label: 'camera frame 2D',
  });
  const opened = await redBox(page);
  await page.getByRole('tab', { name: /Cameras/ }).click();
  await page.getByRole('button', { name: 'Cam 2D · frame view' }).click();
  await page.waitForTimeout(FRAME_SETTLE_MS);
  const framed = await redBox(page);
  await context.close();
  return { opened, framed, diagnostics };
}

/** How far the box's centre sits from the canvas centre, in px, or Infinity for no box. */
function offCentre({ box, width, height }) {
  if (!box) return Infinity;
  return Math.max(
    Math.abs(box.left + box.width / 2 - width / 2),
    Math.abs(box.top + box.height / 2 - height / 2)
  );
}

/** Records the scenario's claims on `gate`. */
export function checkCameraFrame2D(gate, { opened, framed, diagnostics }) {
  gate.check(
    offCentre(opened) > CENTRE_TOLERANCE_PX,
    `[camera frame 2D] the fit on open already centres the square, so the frame proves nothing: ${JSON.stringify(opened)}`
  );
  gate.check(
    offCentre(framed) <= CENTRE_TOLERANCE_PX,
    `[camera frame 2D] the frame left the square ${offCentre(framed)} px off the centre: ${JSON.stringify(framed)}`
  );
  gate.check(
    !!framed.box && Math.abs(framed.box.width - FRAMED_SQUARE_PX) <= SIZE_TOLERANCE_PX,
    `[camera frame 2D] the frame drew the square ${framed.box?.width} px across, expected ${FRAMED_SQUARE_PX} at zoom 2`
  );
  checkDiagnostics(gate, '[camera frame 2D]', diagnostics);
}
