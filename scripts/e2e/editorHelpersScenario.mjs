import { diffMask } from '../vscode/pixels.mjs';
import { findCanvas, settleCanvas } from '../visual/previewServer.mjs';
import { PERFORMANCE_TESTIDS } from '../visual/preview/appContract.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';

export const HELPERS_FIXTURE = 'unit-editor-helpers.tscn';
export const FOG_FIXTURE = 'unit-editor-helpers-fog.tscn';

/** The Display toggles that change what the 3D view of each fixture draws, by label. */
export const DRAWN_TOGGLES = {
  [HELPERS_FIXTURE]: ['Gizmos', 'Collisions', 'Labels', 'Navigation', 'Grid', 'Preview Sun', 'Preview Sky'],
  [FOG_FIXTURE]: ['Fog'],
};

// The smallest change, the gizmos, covers about 800 pixels at this size.
export const HELPER_PIXELS = 300;

async function shoot(page) {
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[Editor helpers] ${reason}`);
  const { buffer, reason: settleReason } = await settleCanvas(page, canvas);
  if (!buffer) throw new Error(`[Editor helpers] the canvas never settled: ${settleReason}`);
  return buffer;
}

async function flip(page, label) {
  await toggleMenu(page);
  await page.getByTestId(`display-toggle-${label}`).click();
  await toggleMenu(page);
}

async function toggleMenu(page) {
  await page.getByTestId('display-menu-button').click();
}

/** The pixels each flip changes, each against the frame before it, so every frame is shot once. */
async function runDrawnToggles(browser, baseUrl, fixture) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture,
    label: 'Editor helpers',
  });
  // Once, so the first frame shows what the menu's first opening changes, before any flip.
  await toggleMenu(page);
  await toggleMenu(page);
  let previous = await shoot(page);
  const pixels = {};
  for (const label of DRAWN_TOGGLES[fixture]) {
    await flip(page, label);
    const flipped = await shoot(page);
    pixels[label] = diffMask(previous, flipped).diffPixels;
    previous = flipped;
  }
  await context.close();
  return { pixels, diagnostics };
}

const hasPerformancePanel = (page) => page.getByTestId(PERFORMANCE_TESTIDS.overlay).isVisible();

/** Whether the panel shows after the Performance toggle turns on, and after it turns off. */
async function runPerformance(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: HELPERS_FIXTURE,
    label: 'Editor helpers performance',
  });
  await flip(page, 'Performance');
  const shownOn = await hasPerformancePanel(page);
  await flip(page, 'Performance');
  const shownOff = await hasPerformancePanel(page);
  await context.close();
  return { shownOn, shownOff, diagnostics };
}

export async function runEditorHelpersScenario(browser, baseUrl) {
  return {
    helpers: await runDrawnToggles(browser, baseUrl, HELPERS_FIXTURE),
    fog: await runDrawnToggles(browser, baseUrl, FOG_FIXTURE),
    performance: await runPerformance(browser, baseUrl),
  };
}

function checkDrawn(gate, fixture, { pixels }) {
  for (const label of DRAWN_TOGGLES[fixture]) {
    gate.check(
      pixels[label] > HELPER_PIXELS,
      `[Editor helpers] ${label} on ${fixture} changed ${pixels[label]} px, expected over ${HELPER_PIXELS}`
    );
  }
}

/** Records the scenario's claims on `gate`. */
export function checkEditorHelpers(gate, { helpers, fog, performance }) {
  checkDrawn(gate, HELPERS_FIXTURE, helpers);
  checkDrawn(gate, FOG_FIXTURE, fog);
  gate.check(performance.shownOn, '[Editor helpers] Performance on shows no panel over the view');
  gate.check(!performance.shownOff, '[Editor helpers] Performance off still shows the panel');
  for (const [label, run] of Object.entries({ helpers, fog, performance })) {
    checkDiagnostics(gate, `[Editor helpers ${label}]`, run.diagnostics);
  }
}

/** One line of what the scenario measured, pass or fail. */
export const measureEditorHelpers = ({ helpers, fog }) =>
  `editor helpers  ${Object.entries({ ...helpers.pixels, ...fog.pixels })
    .map(([label, changed]) => `${label}=${changed}px`)
    .join(' ')}`;
