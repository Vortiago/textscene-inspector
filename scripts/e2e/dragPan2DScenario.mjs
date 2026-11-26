import { CANVAS_2D_TESTIDS, settleCanvas } from '../visual/previewServer.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { FIXTURE_2D } from './editorViewScenarios.mjs';

/** Each drag's pointer travel. A pan that the browser cancels mid-drag travels less. */
export const DRAG_PX = 80;
const DRAGS = 3;
const STEPS_PER_DRAG = 8;

/** The 2D frame's translate, which is the stage pan. */
const panOf = (page) =>
  page.getByTestId(CANVAS_2D_TESTIDS.frame).evaluate((frame) => {
    const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(frame.style.transform) ?? [];
    return { x: Number(x), y: Number(y) };
  });

/** Drags the stage with a real mouse, once from a clean page and again over a page-wide text selection. */
export async function runDragPan2DScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_2D,
    label: 'drag pan 2D',
  });
  await settleCanvas(page, canvas);
  const stage = await page.getByTestId(CANVAS_2D_TESTIDS.stage).boundingBox();
  const x = stage.x + stage.width / 2;
  const y = stage.y + stage.height / 2;
  const travels = [];
  const drag = async () => {
    const before = await panOf(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= STEPS_PER_DRAG; step++) {
      await page.mouse.move(x + (DRAG_PX * step) / STEPS_PER_DRAG, y);
    }
    await page.mouse.up();
    travels.push((await panOf(page)).x - before.x);
  };
  for (let i = 0; i < DRAGS; i++) await drag();
  // A selection left by a double-click or a select-all in a panel turns a press into a native drag.
  await page.keyboard.press('ControlOrMeta+a');
  for (let i = 0; i < DRAGS; i++) await drag();
  await context.close();
  return { travels, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkDragPan2D(gate, { travels, diagnostics }) {
  checkDiagnostics(gate, '[drag pan 2D]', diagnostics);
  travels.forEach((travel, index) => {
    gate.check(
      Math.abs(travel - DRAG_PX) < 0.5,
      `[drag pan 2D] drag ${index + 1} panned ${travel} px, expected ${DRAG_PX}`
    );
  });
}

export function measureDragPan2D({ travels }) {
  return `drag pan 2D  travels=${travels.join(', ')} px`;
}
