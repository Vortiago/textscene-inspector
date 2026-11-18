import { diffMask } from '../vscode/pixels.mjs';
import { findCanvas, settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';

const FIXTURE_3D = 'in-game/unit-in-game-call-camera3d.tscn';
const FIXTURE_2D = 'in-game/unit-in-game-call-camera2d.tscn';

// A camera switch moves thousands of pixels, and an unchanged view differs by none.
export const MOVED_PIXELS = 100;
export const STILL_PIXELS = 20;

/** Each case opens a fixture in one view and clicks its rows in order. */
export const CASES = [
  { name: '3D preview', fixture: FIXTURE_3D, view: '3D', clicks: ['Side', 'Editor camera'] },
  { name: '2D opens 3D', fixture: FIXTURE_3D, view: '2D', clicks: ['Side'] },
  { name: 'In-game 3D', fixture: FIXTURE_3D, view: 'In-game', clicks: ['Side', 'Front'] },
  { name: 'In-game 2D', fixture: FIXTURE_2D, view: 'In-game', clicks: ['Right'] },
  { name: '2D frame', fixture: FIXTURE_2D, view: '2D', clicks: ['Right'] },
];

const viewButtons = (page) => page.getByRole('group', { name: 'Viewport dimension' }).getByRole('button');

async function readView(page) {
  const pressed = await viewButtons(page).evaluateAll((buttons) =>
    buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)
  );
  return pressed.join(' ');
}

/** The names of the panel's rows that match `selector`. */
function readRows(page, selector) {
  return page
    .locator(selector)
    .evaluateAll((rows) => rows.map((row) => row.querySelector('span')?.textContent ?? ''));
}

async function shoot(page) {
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[camera buttons] ${reason}`);
  const { buffer, reason: settleReason } = await settleCanvas(page, canvas);
  if (!buffer) throw new Error(`[camera buttons] the canvas never settled: ${settleReason}`);
  return buffer;
}

async function observe(page, start) {
  const buffer = await shoot(page);
  return {
    view: await readView(page),
    active: await readRows(page, 'button[data-active="true"]'),
    disabled: await readRows(page, 'button[data-active]:disabled'),
    moved: start ? diffMask(start, buffer).diffPixels : 0,
    buffer,
  };
}

/** The observation without its image, which only the steps after it compare against. */
function withoutImage(observation) {
  const { view, active, disabled, moved, row } = observation;
  return { row, view, active, disabled, moved };
}

async function runCase(browser, baseUrl, testCase) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: testCase.fixture,
    label: `camera buttons: ${testCase.name}`,
  });
  await viewButtons(page).getByText(testCase.view, { exact: true }).click();
  await page.getByRole('tab', { name: 'Cameras' }).click();
  const start = await observe(page, null);
  const steps = [];
  for (const row of testCase.clicks) {
    await page.getByRole('button', { name: new RegExp(`^${row}`) }).click();
    steps.push({ row, ...(await observe(page, start.buffer)) });
  }
  await context.close();
  return { name: testCase.name, start: withoutImage(start), steps: steps.map(withoutImage), diagnostics };
}

export async function runCameraButtonsScenario(browser, baseUrl) {
  const results = [];
  for (const testCase of CASES) results.push(await runCase(browser, baseUrl, testCase));
  return results;
}

/** What each step of each case must show: the view, the marked rows, and whether the canvas moved. */
export const EXPECTED = {
  '3D preview': {
    start: { view: '3D', active: ['Editor camera'] },
    steps: [
      { view: '3D', active: ['Side'], moved: true },
      { view: '3D', active: ['Editor camera'], moved: false },
    ],
  },
  '2D opens 3D': {
    start: { view: '2D', active: [] },
    steps: [{ view: '3D', active: ['Side'], moved: true }],
  },
  'In-game 3D': {
    start: { view: 'In-game', active: ['Front'] },
    steps: [
      { view: 'In-game', active: ['Side'], moved: true },
      { view: 'In-game', active: ['Front'], moved: false },
    ],
  },
  'In-game 2D': {
    // `make_current` refuses a Camera2D that is not enabled (`camera_2d.cpp:585`), so its row takes no click.
    start: { view: 'In-game', active: ['Left'], disabled: ['Off'] },
    steps: [{ view: 'In-game', active: ['Right'], disabled: ['Off'], moved: true }],
  },
  '2D frame': {
    start: { view: '2D', active: [] },
    steps: [{ view: '2D', active: [], moved: true }],
  },
};

function checkRows(gate, label, what, expected, found) {
  gate.check(
    JSON.stringify(found) === JSON.stringify(expected),
    `${label} shows ${JSON.stringify(found)} ${what}, expected ${JSON.stringify(expected)}`
  );
}

function checkState(gate, label, expected, found) {
  gate.check(
    found.view === expected.view,
    `${label} shows the ${found.view} view, expected ${expected.view}`
  );
  checkRows(gate, label, 'as active', expected.active, found.active);
  checkRows(gate, label, 'as disabled', expected.disabled ?? [], found.disabled);
}

function checkMoved(gate, label, isMoved, pixels) {
  if (isMoved) {
    gate.check(
      pixels > MOVED_PIXELS,
      `${label} moved ${pixels} px of the view, expected over ${MOVED_PIXELS}`
    );
  } else {
    gate.check(
      pixels < STILL_PIXELS,
      `${label} moved ${pixels} px of the view, expected under ${STILL_PIXELS}`
    );
  }
}

/** Records the scenario's claims on `gate`. */
export function checkCameraButtons(gate, results) {
  for (const result of results) {
    const expected = EXPECTED[result.name];
    const label = `[camera buttons] ${result.name}`;
    checkState(gate, `${label} at the start`, expected.start, result.start);
    expected.steps.forEach((step, index) => {
      const found = result.steps[index];
      const stepLabel = `${label} after a click on ${found.row}`;
      checkState(gate, stepLabel, step, found);
      checkMoved(gate, stepLabel, step.moved, found.moved);
    });
    checkDiagnostics(gate, label, result.diagnostics);
  }
}
