/**
 * The agent tools in the real VS Code extension host: the manifest contributes them,
 * VS Code lists the registered ones, and each answers when invoked. The unit tests
 * cover the handlers against mocks. This file proves the tools exist and run after install.
 * No test here invokes the capture tool: the agent-tool answers suite covers it, with and
 * without a GPU.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { invokeSceneTool } from '../../invokeSceneTool';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';
import { extensionUnderTest, EXTENSION_ID } from '../../smokeProject/sceneEditor';
import {
  AGENT_TOOL_NAMES,
  contributedTools,
  skipWhenEditorLacksLmTools,
  textOf,
} from '../../languageFeatures/agentToolAnswersSuite.testkit';

const PROJECT = 'agent-tools';

const SCENE = [
  '[gd_scene load_steps=2 format=3]',
  '',
  '[sub_resource type="BoxMesh" id="Box_1"]',
  '',
  '[node name="Root" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("Box_1")',
  '',
  '[node name="Broken" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("missing")',
  '',
].join('\n');

suite('Agent tools', () => {
  let scenePath: string;

  suiteSetup(async function () {
    skipWhenEditorLacksLmTools(this);
    writeGodotProject(PROJECT, { 'scene.tscn': SCENE });
    scenePath = path.join(godotProjectDir(PROJECT), 'scene.tscn');
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(() => removeGodotProject(PROJECT));

  test('the manifest contributes every agent tool', () => {
    const names = contributedTools(extensionUnderTest()).map((tool) => tool.name);

    for (const name of AGENT_TOOL_NAMES) {
      assert.ok(names.includes(name), `${name} is contributed`);
    }
  });

  test('VS Code lists the registered agent tools', function () {
    const names = vscode.lm.tools.map((tool) => tool.name);

    for (const name of AGENT_TOOL_NAMES) {
      assert.ok(names.includes(name), `${name} is registered`);
    }
  });

  test('the scene-tree tool returns the node hierarchy', async function () {
    const result = await invokeSceneTool('textscene_scene_tree', scenePath);

    assert.ok(textOf(result).includes('Box (MeshInstance3D)'), `scene tree: ${textOf(result)}`);
  });

  test("the scene-tree tool reads an open editor's unsaved edits, as the Problems panel does", async function () {
    const document = await vscode.workspace.openTextDocument(scenePath);
    const editor = await vscode.window.showTextDocument(document);
    try {
      await editor.edit((edit) =>
        edit.insert(
          document.lineAt(document.lineCount - 1).range.end,
          '[node name="Unsaved" type="Node3D" parent="."]\n'
        )
      );

      const result = await invokeSceneTool('textscene_scene_tree', scenePath);

      assert.ok(document.isDirty, 'the edit is unsaved');
      assert.ok(textOf(result).includes('Unsaved (Node3D)'), `scene tree: ${textOf(result)}`);
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('the lint tool returns a finding for a dangling reference', async function () {
    const result = await invokeSceneTool('textscene_lint', scenePath);

    assert.ok(/\[(error|warning|info)\]/.test(textOf(result)), `lint: ${textOf(result)}`);
  });

  test('the missing-resources tool answers for the scene', async function () {
    const result = await invokeSceneTool('textscene_missing_resources', scenePath);

    assert.ok(textOf(result).includes('scene.tscn'), `missing resources: ${textOf(result)}`);
  });

  test('the open-preview tool opens the preview', async function () {
    const result = await invokeSceneTool('textscene_open_preview', scenePath);

    assert.ok(textOf(result).includes('Opened the TextScene preview'), `open preview: ${textOf(result)}`);
  });
});
