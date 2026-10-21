/**
 * `textscene.copyNodePath` as a user runs it: the cursor sits in an open `.tscn`, the command
 * runs, and the real clipboard holds the path Godot's "Copy Node Path" writes.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  lineStartingWith,
  openProjectDocument,
  removeGodotProject,
  writeGodotProject,
} from '../helpers/godotProjectHelpers';

const EXTENSION_ID = 'vortiago.textscene-inspector';
const COPY_COMMAND = 'textscene.copyNodePath';
const PROJECT = 'copy-node-path';

const SCENE = [
  '[gd_scene format=3 uid="uid://textscene_it_copy_path"]',
  '',
  '[ext_resource type="Texture2D" path="res://icon.png" id="1_icon"]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Player" type="Node3D" parent="."]',
  'visible = false',
  '',
  '[node name="Camera3D" type="Camera3D" parent="Player"]',
  '',
].join('\n');

suite('Copy Node Path', () => {
  let document: vscode.TextDocument;

  suiteSetup(async () => {
    writeGodotProject(PROJECT, { 'scene.tscn': SCENE });
    document = await openProjectDocument(PROJECT, 'scene.tscn');
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(() => removeGodotProject(PROJECT));

  /** The clipboard after the command runs with the cursor on the first line that starts with `prefix`. */
  async function copyFromLineStartingWith(prefix: string): Promise<string> {
    await vscode.env.clipboard.writeText('');
    const editor = await vscode.window.showTextDocument(document);
    const line = lineStartingWith(document, prefix);
    editor.selection = new vscode.Selection(line, 0, line, 0);
    await vscode.commands.executeCommand(COPY_COMMAND);
    return vscode.env.clipboard.readText();
  }

  test('the root heading copies "."', async () => {
    assert.strictEqual(await copyFromLineStartingWith('[node name="Scene"'), '.');
  });

  test('the body of a child copies the child name alone', async () => {
    assert.strictEqual(await copyFromLineStartingWith('visible = false'), 'Player');
  });

  test('a nested heading copies its path from the root, without the root name', async () => {
    assert.strictEqual(await copyFromLineStartingWith('[node name="Camera3D"'), 'Player/Camera3D');
  });

  test('a line outside every node section copies nothing', async () => {
    assert.strictEqual(await copyFromLineStartingWith('[ext_resource'), '');
  });
});
