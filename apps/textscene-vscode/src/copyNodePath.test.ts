/** `TextScene: Copy Node Path` copies the Godot-form path of the node section at the cursor. */

import { describe, expect, it } from 'vitest';
import { vscode } from './test-setup';
import { copyNodePathAtCursor } from './copyNodePath';

const SCENE = [
  '[gd_scene format=3]',
  '[node name="Root" type="Node3D"]',
  '[node name="Player" type="Node3D" parent="."]',
  'visible = false',
  '[node name="Camera3D" type="Camera3D" parent="Player"]',
  '[ext_resource path="res://a.png" type="Texture2D" id="1"]',
].join('\n');

/** An editor over `SCENE` with the cursor at zero-based `line`. */
function editorAtLine(line: number): void {
  const document = {
    uri: { fsPath: '/workspace/test.tscn' },
    version: 1,
    getText: () => SCENE,
  };
  vscode.window.activeTextEditor = { document, selection: { active: { line, character: 0 } } };
}

describe('copyNodePathAtCursor', () => {
  it.each([
    ['the root heading', 1, '.'],
    ['the body of a node section', 3, 'Player'],
    ['a nested heading', 4, 'Player/Camera3D'],
  ])('writes the path for %s', async (_where, line, expected) => {
    editorAtLine(line);
    await copyNodePathAtCursor();
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('shows a message and copies nothing off a node section', async () => {
    editorAtLine(5);
    await copyNodePathAtCursor();
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Put the cursor in a [node] section to copy its node path.'
    );
  });

  it('shows the same message with no editor open', async () => {
    vscode.window.activeTextEditor = undefined;
    await copyNodePathAtCursor();
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});
