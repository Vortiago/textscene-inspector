/**
 * Issue #221 — pure helpers behind multi-file / drag-and-drop upload.
 */
import { describe, expect, it } from 'vitest';
import { pickTscnFile, matchResourceFiles } from './multiFileUpload';

const SCENE_WITH_RESOURCES = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://textures/player.png" id="1_abc"]
[ext_resource type="PackedScene" path="res://scenes/enemy.tscn" id="2_def"]

[node name="Root" type="Node3D"]
`;

function makeFile(name: string, type = 'application/octet-stream'): File {
  return new File(['x'], name, { type });
}

describe('pickTscnFile', () => {
  it('returns the .tscn file among a mixed batch', () => {
    const tscn = makeFile('scene.tscn');
    const files = [makeFile('player.png'), tscn, makeFile('enemy.tscn')];
    expect(pickTscnFile(files)).toBe(tscn);
  });

  it('matches the extension case-insensitively', () => {
    const tscn = makeFile('Scene.TSCN');
    expect(pickTscnFile([tscn])).toBe(tscn);
  });

  it('returns undefined when no .tscn file is present', () => {
    expect(pickTscnFile([makeFile('player.png'), makeFile('enemy.png')])).toBeUndefined();
  });

  it('returns undefined for an empty file list', () => {
    expect(pickTscnFile([])).toBeUndefined();
  });
});

describe('matchResourceFiles', () => {
  it('matches a file to its res:// path by basename', () => {
    const file = makeFile('player.png');
    const matches = matchResourceFiles(SCENE_WITH_RESOURCES, [file]);
    expect(matches).toEqual([{ path: 'res://textures/player.png', file }]);
  });

  it('matches case-insensitively', () => {
    const file = makeFile('PLAYER.PNG');
    const matches = matchResourceFiles(SCENE_WITH_RESOURCES, [file]);
    expect(matches).toEqual([{ path: 'res://textures/player.png', file }]);
  });

  it('matches multiple files to multiple resource paths', () => {
    const texture = makeFile('player.png');
    const subScene = makeFile('enemy.tscn');
    const matches = matchResourceFiles(SCENE_WITH_RESOURCES, [texture, subScene]);
    expect(matches).toEqual(
      expect.arrayContaining([
        { path: 'res://textures/player.png', file: texture },
        { path: 'res://scenes/enemy.tscn', file: subScene },
      ])
    );
    expect(matches).toHaveLength(2);
  });

  it('silently drops a file that matches no external-resource reference', () => {
    const unrelated = makeFile('unrelated.png');
    expect(matchResourceFiles(SCENE_WITH_RESOURCES, [unrelated])).toEqual([]);
  });

  it('returns an empty array for an empty file list without parsing', () => {
    expect(matchResourceFiles(SCENE_WITH_RESOURCES, [])).toEqual([]);
  });
});
