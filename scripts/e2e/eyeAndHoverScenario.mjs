/* global requestAnimationFrame, MutationObserver */
import { pixelsWhere } from '../vscode/pixels.mjs';
import { settleCanvas } from '../visual/previewServer.mjs';
import { expandAllTreeRows, readSelectedPaths, SELECT_SETTLE_MS, treeRow } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { INSTANCE_CLICK_FIXTURE, redBoxCentres } from './instanceClickScenario.mjs';

export const EYE_AND_HOVER_FIXTURE = INSTANCE_CLICK_FIXTURE;
export const HIDDEN_ROW = 'Root/Locked';
export const HOVERED_ROW = 'Root/Open';

// SelectionHighlight's box is pure green, which no part of this fixture or the grid draws.
const isOutline = (r, g, b) => g > 200 && r < 60 && b < 60;

/** The count of outline pixels in a canvas screenshot. */
export const outlinePixels = (buffer) => pixelsWhere(buffer, isOutline);

async function outlineAfter(page, canvas, act) {
  await act();
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return outlinePixels(await canvas.screenshot());
}

async function hoverRows(page, canvas) {
  // expandAllTreeRows leaves the pointer on a row.
  const before = await outlineAfter(page, canvas, () => page.mouse.move(0, 0));
  const hovered = await outlineAfter(page, canvas, () => treeRow(page, HOVERED_ROW).hover());
  const selectedWhileHovered = await readSelectedPaths(page);
  const left = await outlineAfter(page, canvas, () => page.mouse.move(0, 0));
  return { before, hovered, left, selectedWhileHovered };
}

/** A read that waits on a task, as an `import()` does, waits behind about 4 frames of the view. */
export const MAX_EYE_FRAMES = 1;

/** The frames the page draws between a click on `eye` and its "Show node" label, null if it never flips. */
function framesToShowLabel(eye) {
  return eye.evaluate(
    (button, limitMs) =>
      new Promise((resolve) => {
        let frames = 0;
        let isWaiting = true;
        const countFrame = () => {
          frames++;
          if (isWaiting) requestAnimationFrame(countFrame);
        };
        const finish = (answer) => {
          isWaiting = false;
          resolve(answer);
        };
        new MutationObserver((_, observer) => {
          if (button.getAttribute('aria-label') !== 'Show node') return;
          observer.disconnect();
          finish(frames);
        }).observe(button, { attributes: true });
        requestAnimationFrame(countFrame);
        button.click();
        setTimeout(() => finish(null), limitMs);
      }),
    SELECT_SETTLE_MS * 10
  );
}

async function clickEye(page, canvas) {
  const eye = treeRow(page, HIDDEN_ROW).locator('button[aria-label$=" node"]');
  const labelBefore = await eye.getAttribute('aria-label');
  const framesToLabel = await framesToShowLabel(eye);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  await page.mouse.move(0, 0);
  return {
    labelBefore,
    framesToLabel,
    labelAfter: await eye.getAttribute('aria-label'),
    boxesAfter: redBoxCentres(await canvas.screenshot()),
  };
}

export async function runEyeAndHoverScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: EYE_AND_HOVER_FIXTURE,
    label: 'eye and hover',
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  const boxesBefore = redBoxCentres(await canvas.screenshot());
  const hover = await hoverRows(page, canvas);
  const eye = await clickEye(page, canvas);
  await context.close();
  return { boxesBefore, hover, eye, diagnostics };
}

/** Whether every red pixel left lies right of the middle between the two boxes before. */
function isLeftBoxGone(before, after) {
  return !!before && !!after && after.left.x > (before.left.x + before.right.x) / 2;
}

/** Records the scenario's claims on `gate`. */
export function checkEyeAndHover(gate, { boxesBefore, hover, eye, diagnostics }) {
  checkDiagnostics(gate, '[eye and hover]', diagnostics);
  gate.check(
    hover.before === 0 && hover.left === 0,
    `[eye and hover] expected no outline with no row hovered, got ${hover.before} pixels before and ${hover.left} after`
  );
  gate.check(hover.hovered > 0, `[eye and hover] a hovered ${HOVERED_ROW} row draws no outline in the view`);
  gate.check(
    hover.selectedWhileHovered.length === 0,
    `[eye and hover] a hovered row selects [${hover.selectedWhileHovered.join(', ')}], expected none`
  );
  gate.check(
    eye.labelBefore === 'Hide node' && eye.labelAfter === 'Show node',
    `[eye and hover] the ${HIDDEN_ROW} eye reads "${eye.labelBefore}" then "${eye.labelAfter}", ` +
      'expected "Hide node" then "Show node"'
  );
  gate.check(
    eye.framesToLabel !== null && eye.framesToLabel <= MAX_EYE_FRAMES,
    `[eye and hover] the ${HIDDEN_ROW} eye flips its label ${eye.framesToLabel} frames after the click, ` +
      `expected at most ${MAX_EYE_FRAMES}`
  );
  gate.check(
    isLeftBoxGone(boxesBefore, eye.boxesAfter),
    `[eye and hover] the view draws boxes at ${JSON.stringify(eye.boxesAfter)} after the eye hides ${HIDDEN_ROW}, ` +
      `expected one box from ${JSON.stringify(boxesBefore)}`
  );
}

export const measureEyeAndHover = ({ boxesBefore, hover, eye }) =>
  `eye and hover  outline pixels: ${hover.before} / hovered ${hover.hovered} / left ${hover.left} | ` +
  `label in ${eye.framesToLabel} frames | boxes before the eye: ${JSON.stringify(boxesBefore)}, after: ${JSON.stringify(eye.boxesAfter)}`;
