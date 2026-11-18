import { diffMask } from '../vscode/pixels.mjs';
import { findCanvas, settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { clickCameraRow } from './cameraPreviewScenario.mjs';
import { openFixture } from './openFixture.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.evaluate` callback.

const FIXTURE_3D = 'in-game/unit-in-game-call-camera3d.tscn';
const FIXTURE_2D = 'in-game/unit-in-game-call-camera2d.tscn';
const FIXTURE_SUBVIEWPORT = 'in-game/unit-in-game-call-subviewport.tscn';
const FIXTURE_NO_CAMERA = 'unit-box-mesh.tscn';

// A camera switch moves hundreds of pixels or more, and an unchanged view differs by none.
export const MOVED_PIXELS = 100;
export const STILL_PIXELS = 20;

const ROWS_3D = ['Front', 'Side', 'Top'];
const ROWS_2D = ['Left', 'Off', 'Right'];
const EDITOR_ROW = 'Editor camera';

/** Each case opens a fixture in one view and runs its clicks, outside calls and view switches in order. */
export const CASES = [
  {
    name: '3D preview',
    fixture: FIXTURE_3D,
    view: '3D',
    steps: [{ click: 'Side' }, { click: EDITOR_ROW }],
    expected: {
      start: { view: '3D', rows: [EDITOR_ROW, ...ROWS_3D], active: [EDITOR_ROW] },
      steps: [
        { view: '3D', active: ['Side'], moved: true },
        { view: '3D', active: [EDITOR_ROW], moved: false },
      ],
    },
  },
  {
    // The editor camera draws another picture than the preview, so the preview drew through Side.
    name: '2D opens 3D',
    fixture: FIXTURE_3D,
    view: '2D',
    steps: [{ click: 'Side' }, { click: EDITOR_ROW }],
    expected: {
      start: { view: '2D', rows: [EDITOR_ROW, ...ROWS_3D], active: [] },
      steps: [
        { view: '3D', active: ['Side'], moved: true },
        { view: '3D', active: [EDITOR_ROW], differsFrom: 0 },
      ],
    },
  },
  {
    name: 'In-game click',
    fixture: FIXTURE_3D,
    view: 'In-game',
    steps: [{ click: 'Side' }, { click: 'Front' }],
    expected: {
      start: { view: 'In-game', rows: ROWS_3D, active: ['Front'] },
      steps: [
        { view: 'In-game', active: ['Side'], moved: true },
        { view: 'In-game', active: ['Front'], moved: false },
      ],
    },
  },
  {
    // `clear_current` hands the viewport to the first camera that entered it (`viewport.cpp:4609-4623`).
    name: 'In-game outside calls',
    fixture: FIXTURE_3D,
    view: 'In-game',
    steps: [{ call: ['Side', 'make_current'] }, { call: ['Side', 'clear_current'] }],
    expected: {
      start: { view: 'In-game', active: ['Front'] },
      steps: [
        { view: 'In-game', active: ['Side'], moved: true },
        { view: 'In-game', active: ['Front'], moved: false },
      ],
    },
  },
  {
    // Godot's editor preview never moves the game's current camera.
    name: 'In-game kept across views',
    fixture: FIXTURE_3D,
    view: 'In-game',
    steps: [{ click: 'Side' }, { view: '3D' }, { click: 'Top' }, { view: 'In-game' }],
    expected: {
      start: { view: 'In-game', active: ['Front'] },
      steps: [
        { view: 'In-game', active: ['Side'], moved: true },
        { view: '3D', active: [EDITOR_ROW] },
        { view: '3D', active: ['Top'] },
        { view: 'In-game', active: ['Side'], sameAs: 0 },
      ],
    },
  },
  {
    // A view that drew the preview would not move when the game's own camera moves to it.
    name: 'Preview then In-game',
    fixture: FIXTURE_3D,
    view: '3D',
    steps: [{ click: 'Side' }, { view: 'In-game' }, { click: 'Side' }],
    expected: {
      start: { view: '3D', active: [EDITOR_ROW] },
      steps: [
        { view: '3D', active: ['Side'], moved: true },
        { view: 'In-game', active: ['Front'] },
        { view: 'In-game', active: ['Side'], differsFrom: 1 },
      ],
    },
  },
  {
    // `make_current` refuses a Camera2D that is not enabled (`camera_2d.cpp:585`), so its row takes no click.
    name: 'In-game 2D',
    fixture: FIXTURE_2D,
    view: 'In-game',
    steps: [{ click: 'Right' }],
    expected: {
      start: { view: 'In-game', rows: ROWS_2D, active: ['Left'], disabled: ['Off'] },
      steps: [{ view: 'In-game', active: ['Right'], disabled: ['Off'], moved: true }],
    },
  },
  {
    name: '2D frame',
    fixture: FIXTURE_2D,
    view: '2D',
    steps: [{ click: 'Right' }],
    expected: {
      start: { view: '2D', rows: [EDITOR_ROW, ...ROWS_2D], active: [] },
      steps: [{ view: '2D', active: [], moved: true }],
    },
  },
  {
    name: 'Camera2D rows in 3D',
    fixture: FIXTURE_2D,
    view: '3D',
    steps: [],
    expected: { start: { view: '3D', rows: [EDITOR_ROW, ...ROWS_2D], active: [EDITOR_ROW] }, steps: [] },
  },
  {
    // Each viewport keeps its own current camera, so a pick inside the SubViewport leaves the root's.
    name: 'In-game SubViewport',
    fixture: FIXTURE_SUBVIEWPORT,
    view: 'In-game',
    steps: [{ click: 'Close' }],
    expected: {
      start: { view: 'In-game', rows: ['Far', 'Close', 'Root'], active: ['Far', 'Root'] },
      steps: [{ view: 'In-game', active: ['Close', 'Root'], moved: true }],
    },
  },
  ...['3D', '2D', 'In-game'].map((view) => ({
    name: `No camera in ${view}`,
    fixture: FIXTURE_NO_CAMERA,
    view,
    steps: [],
    expected: { start: { view, rows: [], active: [], isEmpty: true }, steps: [] },
  })),
];

const viewButtons = (page) => page.getByRole('group', { name: 'Viewport dimension' }).getByRole('button');

async function readView(page) {
  const pressed = await viewButtons(page).evaluateAll((buttons) =>
    buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)
  );
  return pressed.join(' ');
}

/** The names of the tab's rows that match `selector`. */
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

async function observe(page) {
  return {
    view: await readView(page),
    rows: await readRows(page, 'button[class*="camRow"]'),
    active: await readRows(page, 'button[data-active="true"]'),
    disabled: await readRows(page, 'button[class*="camRow"]:disabled'),
    isEmpty: (await page.getByText('No camera nodes in this scene.').count()) > 0,
    buffer: await shoot(page),
  };
}

function describeStep(step) {
  if (step.click) return `a click on ${step.click}`;
  if (step.call) return `${step.call[0]}.${step.call[1]}() from outside code`;
  return `a switch to the ${step.view} view`;
}

async function runStep(page, step) {
  if (step.click) return clickCameraRow(page, step.click);
  if (step.call) {
    return page.evaluate(([path, method]) => window.textscene.scene.getNode(path).call(method), step.call);
  }
  return viewButtons(page).getByText(step.view, { exact: true }).click();
}

/** The step an expected step compares its drawing with, beside the start. */
const referenceOf = (expected) => expected.sameAs ?? expected.differsFrom;

async function runCase(browser, baseUrl, testCase) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: testCase.fixture,
    label: `camera buttons: ${testCase.name}`,
  });
  await viewButtons(page).getByText(testCase.view, { exact: true }).click();
  await page.getByRole('tab', { name: 'Cameras' }).click();
  const { buffer: startImage, ...start } = await observe(page);
  const images = [];
  const steps = [];
  for (const [index, step] of testCase.steps.entries()) {
    await runStep(page, step);
    const { buffer, ...state } = await observe(page);
    const reference = referenceOf(testCase.expected.steps[index]);
    steps.push({
      step: describeStep(step),
      ...state,
      moved: diffMask(startImage, buffer).diffPixels,
      movedFromReference: reference === undefined ? null : diffMask(images[reference], buffer).diffPixels,
    });
    images.push(buffer);
  }
  await context.close();
  return { name: testCase.name, expected: testCase.expected, start, steps, diagnostics };
}

export async function runCameraButtonsScenario(browser, baseUrl) {
  const results = [];
  for (const testCase of CASES) results.push(await runCase(browser, baseUrl, testCase));
  return results;
}

function checkRows(gate, label, what, expected, found) {
  if (expected === undefined) return;
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
  checkRows(gate, label, 'as rows', expected.rows, found.rows);
  checkRows(gate, label, 'as active', expected.active, found.active);
  checkRows(gate, label, 'as disabled', expected.disabled ?? [], found.disabled);
  gate.check(
    found.isEmpty === (expected.isEmpty ?? false),
    `${label} ${found.isEmpty ? 'shows' : 'does not show'} the empty-tab note`
  );
}

function checkMovement(gate, label, pixels, against, shouldMove) {
  const isRight = shouldMove ? pixels > MOVED_PIXELS : pixels < STILL_PIXELS;
  const bound = shouldMove ? `over ${MOVED_PIXELS}` : `under ${STILL_PIXELS}`;
  gate.check(isRight, `${label} moved ${pixels} px of the view against ${against}, expected ${bound}`);
}

function checkDrawing(gate, label, expected, found) {
  if (expected.moved !== undefined) checkMovement(gate, label, found.moved, 'the start', expected.moved);
  const reference = referenceOf(expected);
  if (reference === undefined) return;
  const shouldMove = expected.differsFrom !== undefined;
  checkMovement(gate, label, found.movedFromReference, `step ${reference + 1}`, shouldMove);
}

/** Records the scenario's claims on `gate`. */
export function checkCameraButtons(gate, results) {
  for (const { expected, ...result } of results) {
    const label = `[camera buttons] ${result.name}`;
    checkState(gate, `${label} at the start`, expected.start, result.start);
    expected.steps.forEach((step, index) => {
      const found = result.steps[index];
      const stepLabel = `${label} after ${found.step}`;
      checkState(gate, stepLabel, step, found);
      checkDrawing(gate, stepLabel, step, found);
    });
    checkDiagnostics(gate, label, result.diagnostics);
  }
}
