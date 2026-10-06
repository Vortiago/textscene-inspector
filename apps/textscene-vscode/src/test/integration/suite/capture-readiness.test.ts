/**
 * The capture tool in a real VS Code, on a scene whose texture takes seconds to build. One
 * call opens the preview and captures it, so the image shows the texture only when the
 * preview reports ready after the texture lands, not when the canvas first draws.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as vscode from 'vscode';
import { CAPTURE_DEADLINE_MS } from '../../../previewCaptureQueue';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';
import { EXTENSION_ID } from '../../smokeProject/sceneEditor';
import {
  imageOf,
  launchedWithoutGpu,
  skipBecause,
  textOf,
} from '../../languageFeatures/agentToolAnswersSuite.testkit';

const PROJECT = 'capture-readiness';

/** A 4096 by 4096 noise texture on a plane: the slowest texture build among the fixtures. */
const FIXTURES = path.resolve(__dirname, '../../../../../../scenes/fixtures');
const SCENE = 'unit-noisetexture2d-4096-tres.tscn';
const MATERIAL = 'unit-noisetexture2d-4096-material.tres';

/** The time past the capture deadline the answer takes to reach the test. */
const ANSWER_MARGIN_MS = 10000;

/**
 * The noise texture changes the luma from pixel to pixel: about 4.4 levels on average in this
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
    writeGodotProject(PROJECT, {
      [SCENE]: fs.readFileSync(path.join(FIXTURES, SCENE), 'utf8'),
      [MATERIAL]: fs.readFileSync(path.join(FIXTURES, MATERIAL), 'utf8'),
    });
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await removeGodotProject(PROJECT);
  });

  test('a capture of a preview it has just opened shows the procedural texture', async function () {
    // The host's deadline ends the call first, so a failure still prints the tool's answer.
    this.timeout(CAPTURE_DEADLINE_MS + ANSWER_MARGIN_MS);
    const scenePath = path.join(godotProjectDir(PROJECT), SCENE);

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
