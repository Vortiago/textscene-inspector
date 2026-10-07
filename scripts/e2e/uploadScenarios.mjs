/**
 * The upload scenarios of the web-app E2E gate: a scene and its texture picked in the toolbar's
 * file input, the same pair dropped on the app, and a scene dropped alone whose texture a second
 * drop then fills. Each arm opens a 3D fixture first, so each also switches the open scene to
 * an uploaded 2D one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, readViewportMode, settleCanvas } from '../visual/previewServer.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { arraysEqual, describeNodePathMismatch, expandAllTreeRows, readOutlinerPaths } from './outliner.mjs';
import { openFixture } from './openFixture.mjs';

/* global DataTransfer */
// `DataTransfer` exists only in the browser that runs the `page.evaluateHandle` callback.

// A path the fixtures mirror lacks, so the texture can only come from the upload. A path the
// mirror holds draws from a fetch and proves nothing about the matching.
export const TEXTURE_PATH = 'res://e2e-upload/marker.png';
export const UPLOADED_SCENE_NAME = 'uploaded-sprites.tscn';

const UPLOADED_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="${TEXTURE_PATH}" id="1_marker"]

[node name="Uploaded" type="Node2D"]
position = Vector2(576, 324)

[node name="Left" type="Sprite2D" parent="."]
texture = ExtResource("1_marker")
position = Vector2(-80, 0)

[node name="Right" type="Sprite2D" parent="."]
texture = ExtResource("1_marker")
position = Vector2(80, 0)
`;

export const UPLOADED_PATHS = ['Uploaded', 'Uploaded/Left', 'Uploaded/Right'];

const SCENE_FILE = { name: UPLOADED_SCENE_NAME, mimeType: 'text/plain', buffer: Buffer.from(UPLOADED_SCENE) };
const TEXTURE_FILE = {
  name: 'marker.png',
  mimeType: 'image/png',
  buffer: readFileSync(join(REPO_ROOT, 'scenes/fixtures/textures/sprite2d-marker.png')),
};

// Far below a passing run (~21k ink px for the two textured sprites, ~16k for their missing
// texture placeholders), as `INK_FLOOR_2D` in `webAppGate.mjs`: the floor only clears noise.
export const INK_FLOOR = 4000;

// The provider's own report of the texture a scene-only drop lacks. It is the behaviour under
// test, so the repeated drop accepts it, and only it.
const MISSING_TEXTURE_WARNING = `File not found: ${TEXTURE_PATH}`;

const APP_ROOT = '[data-testid="app-root"]';
const DROP_HINT = 'drop-zone-hint';

/** Opens `startFixture` in a fresh context, with its canvas settled before any upload. */
async function openStartFixture(browser, baseUrl, startFixture, label) {
  const opened = await openFixture(browser, baseUrl, { fixture: startFixture, label });
  await settleCanvas(opened.page, opened.canvas);
  return opened;
}

/**
 * A real `DataTransfer` in the page holding `files`, as the browser builds one for a drag from
 * the desktop. Playwright drags only between elements of the page, so the gate dispatches it.
 */
function dataTransferOf(page, files) {
  return page.evaluateHandle(
    (entries) => {
      const transfer = new DataTransfer();
      for (const { name, mimeType, base64 } of entries) {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        transfer.items.add(new File([bytes], name, { type: mimeType }));
      }
      return transfer;
    },
    files.map(({ name, mimeType, buffer }) => ({ name, mimeType, base64: buffer.toString('base64') }))
  );
}

/** Drags `files` over the app and drops them. Returns whether the drop hint showed during the drag. */
async function dropFiles(page, files) {
  const dataTransfer = await dataTransferOf(page, files);
  await page.dispatchEvent(APP_ROOT, 'dragenter', { dataTransfer });
  await page.dispatchEvent(APP_ROOT, 'dragover', { dataTransfer });
  const hintShown = await page.getByTestId(DROP_HINT).isVisible();
  await page.dispatchEvent(APP_ROOT, 'drop', { dataTransfer });
  return hintShown;
}

/** Every row of the Resources tab as `{ state, path }`, in display order. */
async function readResourceRows(page) {
  await page.getByRole('tab', { name: 'Resources' }).click();
  return page.$$eval('[data-testid="missing-resources-panel"] [data-state]', (rows) =>
    rows.map((row) => ({ state: row.getAttribute('data-state'), path: row.getAttribute('data-path') }))
  );
}

/** The uploaded scene as the app shows it, once the canvas has settled on it. */
async function readUploadedScene(page, canvas) {
  const label = page.getByTestId('uploaded-tscn-label');
  await label.waitFor();
  const settled = await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  return {
    label: await label.textContent(),
    stage: await readViewportMode(page),
    settleReason: settled.reason,
    frame: settled.buffer,
    inkPixels: settled.buffer ? inkStats(settled.buffer).inkPixels : null,
    paths: await readOutlinerPaths(page),
    resources: await readResourceRows(page),
  };
}

export async function runFileInputUpload(browser, baseUrl, { startFixture }) {
  const opened = await openStartFixture(browser, baseUrl, startFixture, 'upload');
  const { context, page, canvas, diagnostics } = opened;
  await page.getByTestId('upload-tscn-input').setInputFiles([SCENE_FILE, TEXTURE_FILE]);
  const scene = await readUploadedScene(page, canvas);
  await context.close();
  return { ...scene, diagnostics };
}

export async function runDropUpload(browser, baseUrl, { startFixture }) {
  const opened = await openStartFixture(browser, baseUrl, startFixture, 'drop');
  const { context, page, canvas, diagnostics } = opened;
  const hintShown = await dropFiles(page, [SCENE_FILE, TEXTURE_FILE]);
  const hintAfterDrop = await page.getByTestId(DROP_HINT).isVisible();
  const scene = await readUploadedScene(page, canvas);
  await context.close();
  return { ...scene, hintShown, hintAfterDrop, diagnostics };
}

export async function runRepeatedDrop(browser, baseUrl, { startFixture }) {
  const opened = await openStartFixture(browser, baseUrl, startFixture, 'repeated drop');
  const { context, page, canvas, diagnostics } = opened;
  await dropFiles(page, [SCENE_FILE]);
  const sceneOnly = await readUploadedScene(page, canvas);
  await dropFiles(page, [TEXTURE_FILE]);
  const filled = await readUploadedScene(page, canvas);
  await context.close();
  return { sceneOnly, filled, diagnostics };
}

function formatRows(rows) {
  return `[${rows.map(({ state, path }) => `${state} ${path}`).join(', ')}]`;
}

/**
 * Checks one read of the uploaded scene: the toolbar names it, the 2D workspace drew it, the
 * outliner lists its nodes and the Resources tab holds `expectedRows`.
 */
function checkUploadedScene(gate, label, scene, expectedRows) {
  gate.check(
    scene.label === UPLOADED_SCENE_NAME,
    `${label} the toolbar names "${scene.label}", expected "${UPLOADED_SCENE_NAME}"`
  );
  gate.check(scene.stage === '2d', `${label} opened in the "${scene.stage}" workspace, expected "2d"`);
  if (scene.settleReason) {
    gate.check(false, `${label} the canvas never settled: ${scene.settleReason}`);
  } else {
    gate.check(
      scene.inkPixels >= INK_FLOOR,
      `${label} only ${scene.inkPixels} ink pixels, floor is ${INK_FLOOR}, so nothing rendered`
    );
  }
  if (!arraysEqual(UPLOADED_PATHS, scene.paths)) {
    const { missing, extra } = describeNodePathMismatch(UPLOADED_PATHS, scene.paths);
    gate.check(
      false,
      `${label} the outliner lists [${scene.paths.join(', ')}], expected [${UPLOADED_PATHS.join(', ')}] ` +
        `(missing: [${missing.join(', ')}], extra: [${extra.join(', ')}])`
    );
  }
  gate.check(
    formatRows(scene.resources) === formatRows(expectedRows),
    `${label} the Resources tab lists ${formatRows(scene.resources)}, expected ${formatRows(expectedRows)}`
  );
}

/** Byte-equal settled frames: the same files must draw the same scene, whichever way they arrived. */
function checkSameFrame(gate, label, scene, reference) {
  if (!scene.frame || !reference.frame) return;
  gate.check(
    scene.frame.equals(reference.frame),
    `${label} draws a different frame from the same files picked in the file input`
  );
}

function checkFileInputUpload(gate, fileInput) {
  checkUploadedScene(gate, '[upload]', fileInput, []);
  checkDiagnostics(gate, '[upload]', fileInput.diagnostics);
}

function checkDropUpload(gate, drop, fileInput) {
  const label = '[drop]';
  gate.check(drop.hintShown, `${label} the drop hint did not show while the files were dragged over the app`);
  gate.check(!drop.hintAfterDrop, `${label} the drop hint still shows after the drop`);
  checkUploadedScene(gate, label, drop, []);
  checkSameFrame(gate, label, drop, fileInput);
  checkDiagnostics(gate, label, drop.diagnostics);
}

function checkRepeatedDrop(gate, { sceneOnly, filled, diagnostics }, fileInput) {
  checkUploadedScene(gate, '[repeated drop, scene only]', sceneOnly, [
    { state: 'missing', path: TEXTURE_PATH },
  ]);
  if (sceneOnly.frame && fileInput.frame) {
    gate.check(
      !sceneOnly.frame.equals(fileInput.frame),
      '[repeated drop, scene only] draws the textured frame without the texture, so the texture came from elsewhere'
    );
  }
  const filledLabel = '[repeated drop, texture]';
  checkUploadedScene(gate, filledLabel, filled, [{ state: 'uploaded', path: TEXTURE_PATH }]);
  checkSameFrame(gate, filledLabel, filled, fileInput);
  const consoleWarnings = diagnostics.consoleWarnings.filter(
    (text) => !text.endsWith(MISSING_TEXTURE_WARNING)
  );
  checkDiagnostics(gate, '[repeated drop]', { ...diagnostics, consoleWarnings });
}

export function checkUploadScenarios(gate, { fileInput, drop, repeatedDrop }) {
  checkFileInputUpload(gate, fileInput);
  checkDropUpload(gate, drop, fileInput);
  checkRepeatedDrop(gate, repeatedDrop, fileInput);
}
