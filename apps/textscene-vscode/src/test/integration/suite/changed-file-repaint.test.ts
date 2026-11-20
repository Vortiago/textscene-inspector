import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as vscode from 'vscode';
import { hostReturnsImageParts } from '../../../tools/imageResultSupport';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';
import { EXTENSION_ID } from '../../smokeProject/sceneEditor';
import {
  CAPTURE_TEST_TIMEOUT_MS,
  imageOf,
  launchedWithoutGpu,
  skipBecause,
  textOf,
} from '../../languageFeatures/agentToolAnswersSuite.testkit';
import { invokeSceneTool } from '../../invokeSceneTool';

const PROJECT = 'changed-file-repaint';
const SCENE_FILE = 'swatch-plane.tscn';
const TEXTURE_FILE = 'swatch.png';

/** An unshaded plane, so its pixels are the swatch's colour. */
const SCENE = [
  '[gd_scene load_steps=4 format=3]',
  '',
  `[ext_resource type="Texture2D" path="res://${TEXTURE_FILE}" id="1_s"]`,
  '',
  '[sub_resource type="StandardMaterial3D" id="Material_m"]',
  'shading_mode = 0',
  'albedo_texture = ExtResource("1_s")',
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

type Rgb = readonly [number, number, number];
const RED: Rgb = [255, 0, 0];
const BLUE: Rgb = [0, 0, 255];

/** The share of the capture the swatch's colour must lead, which a frame with no plane does not reach. */
const MIN_SWATCH_SHARE = 0.1;

/** The wait for the file watcher, the host's message and the new draw. */
const REPAINT_DEADLINE_MS = 20_000;

function swatchPng([r, g, b]: Rgb): Buffer {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([r, g, b, 255], i);
  return PNG.sync.write(png);
}

/** The share of pixels whose `channel` (0 red, 2 blue) leads the other two by more than 100. */
function shareLedBy(png: PNG, channel: 0 | 2): number {
  let led = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const others = [0, 1, 2].filter((c) => c !== channel).map((c) => png.data[i + c]!);
    if (others.every((other) => png.data[i + channel]! - other > 100)) led++;
  }
  return led / (png.width * png.height);
}

async function capture(scenePath: string): Promise<PNG> {
  const result = await invokeSceneTool('textscene_capture', scenePath);
  const image = imageOf(result);
  assert.ok(image, `expected an image part, found the text ${JSON.stringify(textOf(result))}`);
  return PNG.sync.read(Buffer.from(image.data));
}

suite('Changed file repaint', () => {
  suiteSetup(async function () {
    if (!hostReturnsImageParts()) {
      skipBecause(this, 'this VS Code cannot return an image part, so the capture tool does not register');
    }
    if (launchedWithoutGpu()) {
      skipBecause(this, 'the window launched with --disable-gpu, so the preview has no WebGL to capture');
    }
    writeGodotProject(PROJECT, { [SCENE_FILE]: SCENE });
    fs.writeFileSync(path.join(godotProjectDir(PROJECT), TEXTURE_FILE), swatchPng(RED));
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await removeGodotProject(PROJECT);
  });

  test('a texture written on disk repaints the open preview', async function () {
    this.timeout(CAPTURE_TEST_TIMEOUT_MS + REPAINT_DEADLINE_MS);
    const scenePath = path.join(godotProjectDir(PROJECT), SCENE_FILE);
    const red = shareLedBy(await capture(scenePath), 0);
    assert.ok(
      red >= MIN_SWATCH_SHARE,
      `expected the red swatch on ${MIN_SWATCH_SHARE} of the capture, found ${red}`
    );

    fs.writeFileSync(path.join(godotProjectDir(PROJECT), TEXTURE_FILE), swatchPng(BLUE));

    const deadline = Date.now() + REPAINT_DEADLINE_MS;
    let blue = 0;
    while (blue < MIN_SWATCH_SHARE && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      blue = shareLedBy(await capture(scenePath), 2);
    }
    assert.ok(
      blue >= MIN_SWATCH_SHARE,
      `expected the blue swatch on ${MIN_SWATCH_SHARE} of the capture, found ${blue}`
    );
  });
});
