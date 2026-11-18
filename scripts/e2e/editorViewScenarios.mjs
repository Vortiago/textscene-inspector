import { inkStats } from '../vscode/pixels.mjs';
import { readViewportMode, settleCanvas } from '../visual/previewServer.mjs';
import { installViewMatrixProbe, matricesEqual, formatMatrix, readViewProbe } from './cameraProbe.mjs';
import {
  checkNodePaths,
  expandAllTreeRows,
  readOutlinerPaths,
  SELECT_SETTLE_MS,
  selectOutlinerNode,
} from './outliner.mjs';
import { findRowValue, readInspectorPanel } from './inspector.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { checkInk, checkSizedCanvas, checkStage, INK_FLOOR_2D } from './canvasChecks.mjs';

// No external resource, so the geometry and the nodes, in authored order, are deterministic.
export const FIXTURE_3D = 'unit-box-mesh.tscn';
export const EXPECTED_3D_PATHS = ['Root', 'Root/Box', 'Root/Title', 'Root/Description'];
// Two Label3D nodes with distinct `text`: the view matrix must not move between the two selections.
export const SELECT_A = 'Root/Title';
const SELECT_A_TEXT = 'BoxMesh Test';
const SELECT_B = 'Root/Description';

// A Node2D root (2D workspace, ADR-0006) with one local PNG.
export const FIXTURE_2D = 'unit-sprite2d.tscn';

// Far below a passing run's ~195k ink px: nothing drawn reads as 0, so the floor only clears noise.
const INK_FLOOR_3D = 20000;

export async function run3DScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_3D,
    label: '3D',
    initScripts: [[installViewMatrixProbe, undefined]],
  });

  const settled = await settleCanvas(page, canvas);
  const dims = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const stage = await readViewportMode(page);

  const before = await readViewProbe(page);

  await expandAllTreeRows(page);
  const paths = await readOutlinerPaths(page);

  await selectOutlinerNode(page, SELECT_A);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const afterA = await readViewProbe(page);
  const inspectorA = await readInspectorPanel(page);

  await selectOutlinerNode(page, SELECT_B);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const afterB = await readViewProbe(page);

  await context.close();

  return {
    dims,
    stage,
    settleReason: settled.reason,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    before,
    afterA,
    afterB,
    paths,
    inspectorA,
    diagnostics,
  };
}

export async function run2DScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_2D,
    label: '2D',
  });

  const settled = await settleCanvas(page, canvas);
  const dims = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const stage = await readViewportMode(page);

  await context.close();

  return {
    dims,
    stage,
    settleReason: settled.reason,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    diagnostics,
  };
}

/** Records the 3D scenario's claims on `gate`: the drawing, the outliner, the inspector and the camera. */
export function check3D(gate, threeD) {
  checkSizedCanvas(gate, '[3D]', threeD.dims);
  checkInk(gate, '[3D]', threeD.ink, INK_FLOOR_3D);
  checkStage(gate, '[3D]', threeD.stage, '3d');
  checkDiagnostics(gate, '[3D]', threeD.diagnostics);

  checkNodePaths(gate, `[outliner] the tree of ${FIXTURE_3D}`, EXPECTED_3D_PATHS, threeD.paths);

  gate.check(
    threeD.inspectorA?.name === 'Title',
    `[inspector] selecting ${SELECT_A} shows "${threeD.inspectorA?.name}" in the panel title, expected "Title"`
  );
  const textValue = findRowValue(threeD.inspectorA?.sections, 'Text', 'Text');
  gate.check(
    textValue === SELECT_A_TEXT,
    `[inspector] Text section's Text row reads "${textValue}", expected "${SELECT_A_TEXT}"`
  );

  checkCameraStill(gate, threeD);
}

function checkCameraStill(gate, { before, afterA, afterB }) {
  gate.check(
    !!before && before.updates > 0,
    '[camera] the viewMatrix probe never captured an upload — nothing to compare, ' +
      'this assertion would prove nothing either way'
  );
  if (!before) return;
  gate.check(
    matricesEqual(before.matrix, afterA.matrix),
    `[camera] view matrix changed after selecting ${SELECT_A} — camera moved on selection\n` +
      `    before: ${formatMatrix(before.matrix)}\n` +
      `    after:  ${formatMatrix(afterA?.matrix)}`
  );
  gate.check(
    matricesEqual(afterA.matrix, afterB.matrix),
    `[camera] view matrix changed after selecting ${SELECT_B} (a SECOND, different selection) — ` +
      `camera moved on selection\n` +
      `    after ${SELECT_A}: ${formatMatrix(afterA?.matrix)}\n` +
      `    after ${SELECT_B}: ${formatMatrix(afterB?.matrix)}`
  );
}

export function check2D(gate, twoD) {
  checkSizedCanvas(gate, '[2D]', twoD.dims);
  checkInk(gate, '[2D]', twoD.ink, INK_FLOOR_2D);
  checkStage(gate, '[2D]', twoD.stage, '2d');
  checkDiagnostics(gate, '[2D]', twoD.diagnostics);
}

export const measure3D = (threeD) =>
  `3D  canvas=${threeD.dims.width}x${threeD.dims.height} ink=${threeD.ink?.inkPixels} ` +
  `stage=${threeD.stage} nodes=${threeD.paths.length} camera-updates=${threeD.before?.updates}`;

export const measure2D = (twoD) =>
  `2D  canvas=${twoD.dims.width}x${twoD.dims.height} ink=${twoD.ink?.inkPixels} stage=${twoD.stage}`;
