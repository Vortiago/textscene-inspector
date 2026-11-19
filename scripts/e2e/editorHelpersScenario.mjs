import { diffMask } from '../vscode/pixels.mjs';
import { PERFORMANCE_TESTIDS } from '../visual/preview/appContract.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture, shootCanvas } from './openFixture.mjs';

export const HELPERS_FIXTURE = 'unit-editor-helpers.tscn';
export const FOG_FIXTURE = 'unit-editor-helpers-fog.tscn';

/** The Display toggles that change what the 3D view of each fixture draws, by label. */
const DRAWN_TOGGLES = {
  [HELPERS_FIXTURE]: ['Gizmos', 'Collisions', 'Labels', 'Navigation', 'Grid', 'Preview Sun', 'Preview Sky'],
  [FOG_FIXTURE]: ['Fog'],
};

// The smallest change, the gizmos, covers about 800 pixels at this size.
export const HELPER_PIXELS = 300;

const shoot = (page) => shootCanvas(page, 'Editor helpers');

async function flip(page, label) {
  await toggleMenu(page);
  await page.getByTestId(`display-toggle-${label}`).click();
  await toggleMenu(page);
}

async function toggleMenu(page) {
  await page.getByTestId('display-menu-button').click();
}

const hasPerformancePanel = (page) => page.getByTestId(PERFORMANCE_TESTIDS.overlay).isVisible();

/** Whether the panel shows after the Performance toggle turns on, and after it turns off. */
async function performancePanels(page) {
  await flip(page, 'Performance');
  const shownOn = await hasPerformancePanel(page);
  await flip(page, 'Performance');
  return { shownOn, shownOff: await hasPerformancePanel(page) };
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
  // After the last shot, so the panel over the canvas is in no frame.
  const performance = await performancePanels(page);
  await context.close();
  return { pixels, performance, diagnostics };
}

export async function runEditorHelpersScenario(browser, baseUrl) {
  return {
    helpers: await runDrawnToggles(browser, baseUrl, HELPERS_FIXTURE),
    fog: await runDrawnToggles(browser, baseUrl, FOG_FIXTURE),
  };
}

function checkDrawn(gate, fixture, { pixels, performance }) {
  for (const label of DRAWN_TOGGLES[fixture]) {
    gate.check(
      pixels[label] > HELPER_PIXELS,
      `[Editor helpers] ${label} on ${fixture} changed ${pixels[label]} px, expected over ${HELPER_PIXELS}`
    );
  }
  gate.check(performance.shownOn, `[Editor helpers] Performance on ${fixture} shows no panel over the view`);
  gate.check(!performance.shownOff, `[Editor helpers] Performance off on ${fixture} still shows the panel`);
}

/** Records the scenario's claims on `gate`. */
export function checkEditorHelpers(gate, { helpers, fog }) {
  checkDrawn(gate, HELPERS_FIXTURE, helpers);
  checkDrawn(gate, FOG_FIXTURE, fog);
  for (const [label, run] of Object.entries({ helpers, fog })) {
    checkDiagnostics(gate, `[Editor helpers ${label}]`, run.diagnostics);
  }
}

/** One line of what the scenario measured, pass or fail. */
export const measureEditorHelpers = ({ helpers, fog }) =>
  `editor helpers  ${Object.entries({ ...helpers.pixels, ...fog.pixels })
    .map(([label, changed]) => `${label}=${changed}px`)
    .join(' ')}`;
