import { PNG } from 'pngjs';
import { findCanvas, settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { IN_GAME_BUTTON } from './inGameScenario.mjs';
import { openFixture } from './openFixture.mjs';

export const STRETCH_FIXTURE = 'in-game-stretch/unit-in-game-stretch.tscn';

// The 240 x 135 target reaches 0.28 of the 240 x 240 window from its centre: 0.4 is bar, 0.1 is scene.
const BAR_OFFSET = 0.4;
const SCENE_OFFSET = 0.1;

/** The pixels a stretched window's bars and scene read at, from the canvas's centre column. */
export function stretchProbes({ width, height }) {
  const side = Math.min(width, height);
  const x = Math.floor(width / 2);
  const at = (offset) => ({ x, y: Math.floor(height / 2 + offset * side) });
  return { top: at(-BAR_OFFSET), scene: at(SCENE_OFFSET), bottom: at(BAR_OFFSET) };
}

/** The RGB at each probe of a settled shot. */
export function readProbes(buffer) {
  const png = PNG.sync.read(buffer);
  const rgbAt = ({ x, y }) => {
    const i = (y * png.width + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  return Object.fromEntries(Object.entries(stretchProbes(png)).map(([name, probe]) => [name, rgbAt(probe)]));
}

export async function runInGameStretchScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: STRETCH_FIXTURE,
    label: 'in-game stretch',
  });
  await page.getByRole('button', { name: IN_GAME_BUTTON }).click();
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[in-game stretch] ${STRETCH_FIXTURE}: ${reason}`);
  const settled = await settleCanvas(page, canvas);
  await context.close();
  return { pixels: settled.buffer ? readProbes(settled.buffer) : null, diagnostics };
}

const isBlack = (rgb) => rgb.every((channel) => channel === 0);

/** Records the scenario's claims on `gate`. */
export function checkInGameStretch(gate, result) {
  const label = `[in-game stretch] ${STRETCH_FIXTURE}`;
  gate.check(!!result.pixels, `${label} the canvas never settled`);
  if (result.pixels) {
    const { top, scene, bottom } = result.pixels;
    gate.check(
      isBlack(top) && isBlack(bottom),
      `${label} expected black bars above and below the kept aspect, got ${top} and ${bottom}`
    );
    gate.check(!isBlack(scene), `${label} expected the scene between the bars, got black`);
  }
  checkDiagnostics(gate, '[in-game stretch]', result.diagnostics);
}
