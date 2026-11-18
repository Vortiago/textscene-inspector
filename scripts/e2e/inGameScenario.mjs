import { inkStats } from '../vscode/pixels.mjs';
import { findCanvas, readViewportMode, settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { checkInk, checkSizedCanvas, checkStage, INK_FLOOR_2D } from './canvasChecks.mjs';
import { openFixture } from './openFixture.mjs';

export const IN_GAME_FIXTURE = 'in-game/unit-in-game-camera2d.tscn';
export const IN_GAME_BUTTON = 'In-game';

export async function runInGameScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: IN_GAME_FIXTURE,
    label: 'in-game',
  });
  const openedIn = await readViewportMode(page);

  const button = page.getByRole('button', { name: IN_GAME_BUTTON });
  await button.click();
  const isPressed = (await button.getAttribute('aria-pressed')) === 'true';
  const stageAfter = await readViewportMode(page);

  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[in-game] ${IN_GAME_FIXTURE}: ${reason}`);
  const settled = await settleCanvas(page, canvas);
  const dims = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));

  await context.close();
  return {
    openedIn,
    isPressed,
    stageAfter,
    dims,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    diagnostics,
  };
}

/** Records the scenario's claims on `gate`. */
export function checkInGame(gate, result) {
  checkStage(gate, `[in-game] ${IN_GAME_FIXTURE}`, result.openedIn, '2d');
  gate.check(result.isPressed, `[in-game] the ${IN_GAME_BUTTON} button is not pressed after a click`);
  gate.check(
    result.stageAfter === '3d',
    `[in-game] the 2D stage still shows after the ${IN_GAME_BUTTON} button, so the game view never mounted`
  );
  checkSizedCanvas(gate, '[in-game]', result.dims);
  checkInk(gate, '[in-game]', result.ink, INK_FLOOR_2D);
  checkDiagnostics(gate, '[in-game]', result.diagnostics);
}
