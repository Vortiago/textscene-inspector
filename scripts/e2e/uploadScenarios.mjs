/**
 * The upload scenarios of the web-app E2E gate: a scene and its texture picked in the toolbar's
 * file input, the same pair dropped on the app, and a scene dropped alone whose texture a second
 * drop then fills. Each arm opens a 3D fixture first, so each also switches the open scene to
 * an uploaded 2D one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  installStyle,
  paintedOutChromeCss,
  REPO_ROOT,
  readViewportMode,
  settleCanvas,
} from '../visual/previewServer.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import { checkInk, checkStage, INK_FLOOR_2D } from './canvasChecks.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { checkNodePaths, expandAllTreeRows, readOutlinerPaths } from './outliner.mjs';
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

// The provider's own report of the texture a scene-only drop lacks. It is the behaviour under
// test, so the repeated drop accepts it, and only it.
const MISSING_TEXTURE_WARNING = new RegExp(
  `^\\[FileEventBus\\] .* File not found: ${TEXTURE_PATH.replaceAll('.', '\\.')}$`
);

const APP_ROOT = '[data-testid="app-root"]';
const DROP_HINT = 'drop-zone-hint';

/**
 * Opens `startFixture` in a fresh context, runs `upload` on its page and closes the context,
 * even when a step throws. The toolbar floats over the canvas, and its rounded corners
 * rasterise one step apart between runs, so the frames compare the scene only.
 */
async function withStartFixture(browser, baseUrl, startFixture, label, upload) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: startFixture,
    label,
    initScripts: [[installStyle, paintedOutChromeCss({ canvas2D: false })]],
  });
  try {
    return { ...(await upload(page, canvas)), diagnostics };
  } finally {
    await context.close();
  }
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
    frame: settled.buffer,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    paths: await readOutlinerPaths(page),
    resources: await readResourceRows(page),
  };
}

export function runFileInputUpload(browser, baseUrl, startFixture) {
  return withStartFixture(browser, baseUrl, startFixture, 'upload', async (page, canvas) => {
    await page.getByTestId('upload-tscn-input').setInputFiles([SCENE_FILE, TEXTURE_FILE]);
    return readUploadedScene(page, canvas);
  });
}

export function runDropUpload(browser, baseUrl, startFixture) {
  return withStartFixture(browser, baseUrl, startFixture, 'drop', async (page, canvas) => {
    const hintShown = await dropFiles(page, [SCENE_FILE, TEXTURE_FILE]);
    const hintAfterDrop = await page.getByTestId(DROP_HINT).isVisible();
    return { ...(await readUploadedScene(page, canvas)), hintShown, hintAfterDrop };
  });
}

export function runRepeatedDrop(browser, baseUrl, startFixture) {
  return withStartFixture(browser, baseUrl, startFixture, 'repeated drop', async (page, canvas) => {
    await dropFiles(page, [SCENE_FILE]);
    const sceneOnly = await readUploadedScene(page, canvas);
    await dropFiles(page, [TEXTURE_FILE]);
    return { sceneOnly, filled: await readUploadedScene(page, canvas) };
  });
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
  checkStage(gate, label, scene.stage, '2d');
  checkInk(gate, label, scene.ink, INK_FLOOR_2D);
  checkNodePaths(gate, `${label} the outliner`, UPLOADED_PATHS, scene.paths);
  gate.check(
    formatRows(scene.resources) === formatRows(expectedRows),
    `${label} the Resources tab lists ${formatRows(scene.resources)}, expected ${formatRows(expectedRows)}`
  );
}

/** Whether two settled frames are byte-equal, or `null` when either never settled. */
function sameFrame(scene, reference) {
  return scene.frame && reference.frame ? scene.frame.equals(reference.frame) : null;
}

// The same files must draw the same scene, whichever way they arrived.
function checkSameFrame(gate, label, scene, reference) {
  gate.check(
    sameFrame(scene, reference) !== false,
    `${label} draws a different frame from the same files picked in the file input`
  );
}

function checkFileInputUpload(gate, fileInput) {
  const label = '[upload]';
  checkUploadedScene(gate, label, fileInput, []);
  checkDiagnostics(gate, label, fileInput.diagnostics);
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
  const sceneOnlyLabel = '[repeated drop, scene only]';
  checkUploadedScene(gate, sceneOnlyLabel, sceneOnly, [{ state: 'missing', path: TEXTURE_PATH }]);
  gate.check(
    sameFrame(sceneOnly, fileInput) !== true,
    `${sceneOnlyLabel} draws the textured frame without the texture, so the texture came from elsewhere`
  );
  const filledLabel = '[repeated drop, texture]';
  checkUploadedScene(gate, filledLabel, filled, [{ state: 'uploaded', path: TEXTURE_PATH }]);
  checkSameFrame(gate, filledLabel, filled, fileInput);
  checkDiagnostics(gate, '[repeated drop]', diagnostics, { expectedWarnings: [MISSING_TEXTURE_WARNING] });
}

export function checkUploadScenarios(gate, { fileInput, drop, repeatedDrop }) {
  checkFileInputUpload(gate, fileInput);
  checkDropUpload(gate, drop, fileInput);
  checkRepeatedDrop(gate, repeatedDrop, fileInput);
}
