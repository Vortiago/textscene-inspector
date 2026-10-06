/** Which scene the Scene Tree view follows: the active preview's, or the active `.tscn` editor's. */

import { describe, expect, it } from 'vitest';
import { activeScene } from './activeScene';
import { fakePreview, sceneDocument, textEditor } from './sceneTree.testkit';

describe('activeScene', () => {
  it('follows the active preview while no text editor is active', () => {
    const preview = fakePreview('/workspace/main.tscn', true);

    expect(activeScene([preview], undefined)?.path).toBe('/workspace/main.tscn');
  });

  it('follows the active .tscn text editor', () => {
    const editor = textEditor(sceneDocument('/workspace/level.tscn'));

    expect(activeScene([], editor)?.path).toBe('/workspace/level.tscn');
  });

  it('follows a .TSCN text editor, as Godot reads the extension in any case', () => {
    const editor = textEditor(sceneDocument('/workspace/Level.TSCN'));

    expect(activeScene([], editor)?.path).toBe('/workspace/Level.TSCN');
  });

  it('skips a preview that is open but not active', () => {
    const editor = textEditor(sceneDocument('/workspace/level.tscn'));

    expect(activeScene([fakePreview('/workspace/main.tscn', false)], editor)?.path).toBe(
      '/workspace/level.tscn'
    );
  });

  it('has no scene for an active editor on another file', () => {
    const editor = textEditor(sceneDocument('/workspace/player.gd'));

    expect(activeScene([fakePreview('/workspace/main.tscn', false)], editor)).toBeUndefined();
  });

  it('has no scene for a .tres resource, which carries no node tree', () => {
    const editor = textEditor(sceneDocument('/workspace/material.tres'));

    expect(activeScene([], editor)).toBeUndefined();
  });

  it('has no scene while nothing is open', () => {
    expect(activeScene([], undefined)).toBeUndefined();
  });
});
