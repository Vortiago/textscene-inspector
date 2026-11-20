import * as path from 'path';
import * as vscode from 'vscode';
import { hostReturnsImageParts } from '../../../tools/imageResultSupport';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';
import { EXTENSION_ID } from '../../smokeProject/sceneEditor';
import {
  assertWebviewLoaded,
  CAPTURE_TEST_TIMEOUT_MS,
  skipBecause,
  skipWhenEditorLacksLmTools,
} from '../../languageFeatures/agentToolAnswersSuite.testkit';
import { invokeSceneTool } from '../../invokeSceneTool';

const PROJECT = 'preview-load';

const SCENE = [
  '[gd_scene load_steps=2 format=3]',
  '',
  '[sub_resource type="BoxMesh" id="BoxMesh_b"]',
  '',
  '[node name="World" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("BoxMesh_b")',
  '',
].join('\n');

/** Each closed load holds its open requests of VS Code's 32 shared places for 30 s (ADR-0090). */
const CLOSED_LOADS = 10;

/** Long enough for the webview to start fetching its script, and short of its load. */
const CLOSE_AFTER_MS = 150;

function scenePath(name: string): string {
  return path.join(godotProjectDir(PROJECT), name);
}

/** Opens a preview of `name` and closes every editor while that preview still loads. */
async function openAndCloseDuringLoad(name: string): Promise<void> {
  await invokeSceneTool('textscene_open_preview', scenePath(name));
  await new Promise((resolve) => setTimeout(resolve, CLOSE_AFTER_MS));
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

suite('Preview load', () => {
  const closedScenes = Array.from({ length: CLOSED_LOADS }, (_, i) => `closed-${i}.tscn`);

  suiteSetup(async function () {
    skipWhenEditorLacksLmTools(this);
    if (!hostReturnsImageParts()) {
      skipBecause(this, 'this VS Code cannot return an image part, so the capture tool does not register');
    }
    writeGodotProject(
      PROJECT,
      Object.fromEntries([...closedScenes, 'opened.tscn'].map((name) => [name, SCENE]))
    );
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await removeGodotProject(PROJECT);
  });

  // Without a GPU the capture answers why it has no image, which also proves the webview loaded.
  test('a preview loads after other previews closed during their load', async function () {
    this.timeout(CLOSED_LOADS * 5_000 + CAPTURE_TEST_TIMEOUT_MS);
    for (const name of closedScenes) await openAndCloseDuringLoad(name);

    assertWebviewLoaded(await invokeSceneTool('textscene_capture', scenePath('opened.tscn')));
  });
});
