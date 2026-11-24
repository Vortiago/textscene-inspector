import { settleCanvas } from '../visual/previewServer.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { FIXTURE_2D } from './editorViewScenarios.mjs';

/** Godot's zoom range, 1/128 to 128 (editor_zoom_widget.h:44-45), as the readout prints it. */
export const MAX_READOUT = '12800%';
export const MIN_READOUT = '0.78%';
/** More clicks than either end of the range takes from the fitted view, so a run that stops short fails. */
const CLICK_LIMIT = 80;
/** A covered button fails its click within this, not Playwright's 30 s default. */
const CLICK_TIMEOUT_MS = 5000;

/** Clicks `button` until the readout stops changing. Answers the last readout and the clicks it took. */
async function clickToEnd(button, readout) {
  let last = await readout.textContent();
  for (let clicks = 1; clicks <= CLICK_LIMIT; clicks++) {
    await button.click({ timeout: CLICK_TIMEOUT_MS });
    const now = await readout.textContent();
    if (now === last) return { readout: now, clicks: clicks - 1 };
    last = now;
  }
  return { readout: last, clicks: CLICK_LIMIT };
}

const boxOf = async (locator) => {
  const { x, y, width, height } = await locator.boundingBox();
  return { x, y, width, height };
};

export async function runZoomButtonsScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_2D,
    label: 'zoom buttons',
  });
  await settleCanvas(page, canvas);
  const hud = page.getByTestId('canvas-2d-zoom');
  const zoomIn = hud.getByRole('button', { name: 'Zoom in' });
  const zoomOut = hud.getByRole('button', { name: 'Zoom out' });
  const readout = hud.locator('span');
  const pill = page.getByTestId('viewport-controls-hint');
  const layout = {
    stageWidth: (await page.getByTestId('canvas-2d-stage').boundingBox()).width,
    pill: await boxOf(pill),
    hud: await boxOf(hud),
  };
  const opened = await readout.textContent();
  // Playwright's click fails on a button another element covers, so these clicks also prove it is clear.
  await zoomOut.click({ timeout: CLICK_TIMEOUT_MS });
  const afterOut = await readout.textContent();
  await zoomIn.click({ timeout: CLICK_TIMEOUT_MS });
  const afterIn = await readout.textContent();
  const top = await clickToEnd(zoomIn, readout);
  const bottom = await clickToEnd(zoomOut, readout);
  await context.close();
  return { layout, opened, afterOut, afterIn, top, bottom, diagnostics };
}

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Records the scenario's claims on `gate`. */
export function checkZoomButtons(gate, { layout, opened, afterOut, afterIn, top, bottom, diagnostics }) {
  checkDiagnostics(gate, '[zoom buttons]', diagnostics);
  gate.check(
    !overlaps(layout.pill, layout.hud),
    `[zoom buttons] the controls pill ${JSON.stringify(layout.pill)} covers the zoom HUD ` +
      `${JSON.stringify(layout.hud)} on a ${layout.stageWidth} px stage`
  );
  gate.check(afterOut !== opened, `[zoom buttons] a click on minus left the readout at ${opened}`);
  gate.check(afterIn === opened, `[zoom buttons] minus then plus gave ${afterIn}, expected ${opened}`);
  gate.check(
    top.readout === MAX_READOUT,
    `[zoom buttons] plus stopped at ${top.readout} after ${top.clicks} clicks, expected ${MAX_READOUT}`
  );
  gate.check(
    bottom.readout === MIN_READOUT,
    `[zoom buttons] minus stopped at ${bottom.readout} after ${bottom.clicks} clicks, expected ${MIN_READOUT}`
  );
}

export function measureZoomButtons({ layout, opened, afterOut, top, bottom }) {
  return (
    `zoom buttons  stage=${layout.stageWidth} pill right=${layout.pill.x + layout.pill.width} ` +
    `hud left=${layout.hud.x} | ${opened} minus=${afterOut} | ` +
    `plus to ${top.readout} in ${top.clicks} | minus to ${bottom.readout} in ${bottom.clicks}`
  );
}
