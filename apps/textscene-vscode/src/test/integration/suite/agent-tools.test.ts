/**
 * The agent tools in the real VS Code extension host: the manifest contributes them,
 * VS Code lists the registered ones, and each answers when invoked. The unit tests
 * cover the handlers against mocks; this proves the tools exist and run after install.
 * The capture tool is absent here on purpose: this host launches with `--disable-gpu`
 * on Linux, so no WebGL context exists to capture.
 */

import * as assert from 'assert';
import type { Context } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { godotProjectDir, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';

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

const TOOL_NAMES = [
  'textscene_lint',
  'textscene_scene_tree',
  'textscene_open_preview',
  'textscene_missing_resources',
  'textscene_capture',
] as const;

/** Skips a test on a VS Code below the tools API, and prints why, since mocha reports a skip with no reason. */
function skipWithoutToolsApi(context: Context): never {
  console.log('    skipped: this VS Code predates the vscode.lm tools API');
  context.skip();
}

/** The plain text of a tool result, whichever parts it carries. */
function textOf(result: vscode.LanguageModelToolResult): string {
  return result.content
    .map((part) => {
      const value = (part as { value?: unknown }).value;
      return typeof value === 'string' ? value : '';
    })
    .join('\n');
}

suite('Agent tools', () => {
  let scenePath: string;

  suiteSetup(async () => {
    writeGodotProject(PROJECT, { 'scene.tscn': SCENE });
    scenePath = path.join(godotProjectDir(PROJECT), 'scene.tscn');
    await vscode.extensions.getExtension('vortiago.textscene-inspector')?.activate();
  });

  suiteTeardown(() => {
    removeGodotProject(PROJECT);
  });

  test('the manifest contributes every agent tool', () => {
    const contributes = vscode.extensions.getExtension('vortiago.textscene-inspector')?.packageJSON
      .contributes as { languageModelTools?: Array<{ name: string }> } | undefined;
    const names = (contributes?.languageModelTools ?? []).map((tool) => tool.name);

    for (const name of TOOL_NAMES) {
      assert.ok(names.includes(name), `${name} is contributed`);
    }
  });

  test('VS Code lists the registered agent tools', function () {
    // The tools API is newer than the extension's engines floor. Below it, none registers.
    if (!vscode.lm?.tools) skipWithoutToolsApi(this);
    const names = vscode.lm.tools.map((tool) => tool.name);

    for (const name of TOOL_NAMES) {
      assert.ok(names.includes(name), `${name} is registered`);
    }
  });

  test('the scene-tree tool returns the node hierarchy', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') skipWithoutToolsApi(this);

    const result = await vscode.lm.invokeTool('textscene_scene_tree', { input: { path: scenePath } });

    assert.ok(textOf(result).includes('Box (MeshInstance3D)'), `scene tree: ${textOf(result)}`);
  });

  test('the lint tool returns a finding for a dangling reference', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') skipWithoutToolsApi(this);

    const result = await vscode.lm.invokeTool('textscene_lint', { input: { path: scenePath } });

    assert.ok(/\[(error|warning|info)\]/.test(textOf(result)), `lint: ${textOf(result)}`);
  });

  test('the missing-resources tool answers for the scene', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') skipWithoutToolsApi(this);

    const result = await vscode.lm.invokeTool('textscene_missing_resources', { input: { path: scenePath } });

    assert.ok(textOf(result).includes('scene.tscn'), `missing resources: ${textOf(result)}`);
  });

  test('the open-preview tool opens the preview', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') skipWithoutToolsApi(this);

    const result = await vscode.lm.invokeTool('textscene_open_preview', { input: { path: scenePath } });

    assert.ok(textOf(result).includes('Opened the TextScene preview'), `open preview: ${textOf(result)}`);
  });
});
