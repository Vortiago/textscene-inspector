/**
 * The capture tool in a real VS Code, on a scene with a procedural texture. One call opens the
 * preview and captures it, so the image shows the texture only when the preview reports ready
 * after the texture lands, not when the canvas first draws.
 */

import * as assert from 'assert';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as vscode from 'vscode';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';
import { EXTENSION_ID } from '../../smokeProject/sceneEditor';
import {
  CAPTURE_TEST_TIMEOUT_MS,
  imageOf,
  launchedWithoutGpu,
  skipBecause,
  textOf,
} from '../../languageFeatures/agentToolAnswersSuite.testkit';

const PROJECT = 'capture-readiness';

const SCENE_FILE = 'noise-plane.tscn';

/**
 * The side of the noise texture, in pixels. Its build outlasts the canvas's first draw, and
 * stays well inside the test timeout on a CI runner. A 4096 texture takes 17 s with software WebGL.
 */
const NOISE_SIZE = 1024;

/** A plane with a procedural noise texture, which the webview builds after the canvas first draws. */
const SCENE = [
  '[gd_scene load_steps=4 format=3]',
  '',
  '[sub_resource type="FastNoiseLite" id="FastNoiseLite_n"]',
  'seed = 7',
  'frequency = 0.016',
  'fractal_type = 2',
  '',
  '[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_t"]',
  `width = ${NOISE_SIZE}`,
  `height = ${NOISE_SIZE}`,
  'seamless = true',
  'noise = SubResource("FastNoiseLite_n")',
  '',
  '[sub_resource type="StandardMaterial3D" id="Material_m"]',
  'albedo_texture = SubResource("NoiseTexture2D_t")',
  '',
  '[sub_resource type="PlaneMesh" id="PlaneMesh_p"]',
  'size = Vector2(4, 4)',
  'material = SubResource("Material_m")',
  '',
  '[node name="World" type="Node3D"]',
  '',
  '[node name="Ground" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("PlaneMesh_p")',
  '',
].join('\n');

/**
 * The noise texture changes the luma from pixel to pixel: about 4.1 levels on average in this
 * capture. The untextured plane and the sky change it by about 0.2, almost all at their edges.
 */
const MIN_TEXTURED_LUMA_STEP = 1;

/** The Rec. 601 luma of the pixel at `x`, `y`. */
function luma(png: PNG, x: number, y: number): number {
  const i = (y * png.width + x) * 4;
  return 0.299 * png.data[i]! + 0.587 * png.data[i + 1]! + 0.114 * png.data[i + 2]!;
}

/** The mean absolute luma difference between each pixel and its left neighbour. */
function meanLumaStep(png: PNG): number {
  let total = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 1; x < png.width; x++) total += Math.abs(luma(png, x, y) - luma(png, x - 1, y));
  }
  return total / (png.height * (png.width - 1));
}

suite('Capture readiness', () => {
  suiteSetup(async function () {
    if (typeof vscode.LanguageModelDataPart?.image !== 'function') {
      skipBecause(this, 'this VS Code predates the image part, so the capture tool does not register');
    }
    if (launchedWithoutGpu()) {
      skipBecause(this, 'the window launched with --disable-gpu, so the preview has no WebGL to capture');
    }
    writeGodotProject(PROJECT, { [SCENE_FILE]: SCENE });
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await removeGodotProject(PROJECT);
  });

  test('a capture of a preview it has just opened shows the procedural texture', async function () {
    this.timeout(CAPTURE_TEST_TIMEOUT_MS);
    const scenePath = path.join(godotProjectDir(PROJECT), SCENE_FILE);

    const result = await vscode.lm.invokeTool('textscene_capture', { input: { path: scenePath } });
    const image = imageOf(result);

    assert.ok(image, `expected an image part, found the text ${JSON.stringify(textOf(result))}`);
    const step = meanLumaStep(PNG.sync.read(Buffer.from(image.data)));
    assert.ok(
      step >= MIN_TEXTURED_LUMA_STEP,
      `expected the noise texture, a mean luma step of at least ${MIN_TEXTURED_LUMA_STEP}, found ${step.toFixed(2)}`
    );
  });
});
