/**
 * The camera-preview scenario of the web-app E2E gate. It previews a Camera3D from the
 * Cameras tab, navigates during the preview, and ends it, reading each view matrix the
 * GPU receives (`cameraProbe.mjs`). Godot ignores navigation while it previews a camera,
 * and puts its editor camera back, untouched, when the preview ends.
 */
import { settleCanvas } from '../visual/previewServer.mjs';
import { installViewMatrixProbe, matricesEqual, formatMatrix, readViewProbe } from './cameraProbe.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.waitForFunction` callback.

export const CAMERA_PREVIEW_FIXTURE = 'unit-multi-camera.tscn';
const PREVIEWED_CAMERA = 'TopCamera';
const EDITOR_CAMERA_ROW = 'Editor camera';

// Navigation that moves nothing draws no frame to wait for, so it waits a fixed time, as a
// selection does in `webAppGate.mjs`.
const NAVIGATION_SETTLE_MS = 400;
// Each camera switch draws a new view in a frame or two. A switch that never draws one
// times out here, and the check below reports the unchanged matrix.
const SWITCH_TIMEOUT_MS = 5000;

async function readViewMatrix(page) {
  return (await readViewProbe(page))?.matrix ?? null;
}

/** Runs `step`, then waits until the GPU receives a view matrix other than the one before it. */
async function switchView(page, step) {
  const before = await readViewMatrix(page);
  await step();
  await page
    .waitForFunction(
      (previous) => JSON.stringify(window.__tscnReadViewMatrix()?.matrix) !== JSON.stringify(previous),
      before,
      { timeout: SWITCH_TIMEOUT_MS }
    )
    .catch(() => {});
  return readViewMatrix(page);
}

function clickCameraRow(page, name) {
  return page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

/** An orbit, a pan and a wheel zoom over the middle of the canvas. */
async function navigate(page, canvas) {
  const box = await canvas.boundingBox();
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(centre.x + 150, centre.y + 40, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Shift');
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(NAVIGATION_SETTLE_MS);
}

export async function runCameraPreviewScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: CAMERA_PREVIEW_FIXTURE,
    label: 'camera preview',
    initScripts: [[installViewMatrixProbe, undefined]],
  });
  await settleCanvas(page, canvas);
  const editor = await readViewMatrix(page);

  await page.getByRole('tab', { name: 'Cameras' }).click();
  const preview = await switchView(page, () => clickCameraRow(page, PREVIEWED_CAMERA));
  await navigate(page, canvas);
  const previewAfterNavigation = await readViewMatrix(page);

  const editorAfterPreview = await switchView(page, () => clickCameraRow(page, EDITOR_CAMERA_ROW));
  const previewAgain = await switchView(page, () => clickCameraRow(page, PREVIEWED_CAMERA));
  const editorAfterReset = await switchView(page, () => page.getByTestId('reset-camera-button').click());

  await context.close();

  return {
    editor,
    preview,
    previewAfterNavigation,
    editorAfterPreview,
    previewAgain,
    editorAfterReset,
    diagnostics,
  };
}

/** Records the scenario's claims on `gate`. */
export function checkCameraPreview(gate, result) {
  const label = '[camera preview]';
  gate.check(
    !!result.editor && !!result.preview,
    `${label} the viewMatrix probe never captured an upload, so no comparison below proves anything`
  );
  gate.check(
    !matricesEqual(result.editor, result.preview),
    `${label} previewing ${PREVIEWED_CAMERA} left the view on the editor camera\n` +
      `    editor:  ${formatMatrix(result.editor)}`
  );
  const sameView = (expected, found, claim) =>
    gate.check(
      matricesEqual(expected, found),
      `${label} ${claim}\n    expected: ${formatMatrix(expected)}\n    found:    ${formatMatrix(found)}`
    );
  sameView(result.preview, result.previewAfterNavigation, 'navigation moved the previewed Camera3D');
  sameView(result.editor, result.editorAfterPreview, 'ending the preview did not restore the editor camera');
  sameView(result.preview, result.previewAgain, 'a second preview showed another pose than the first');
  sameView(result.editor, result.editorAfterReset, 'Reset Camera left the preview on screen');
  checkDiagnostics(gate, label, result.diagnostics);
}
