/**
 * Pure helpers behind multi-file / drag-and-drop upload.
 */
import { describe, expect, it } from 'vitest';
import { pickRootMostTscn, matchResourceFiles, extResourcePaths } from './multiFileUpload';

const SCENE_WITH_RESOURCES = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://textures/player.png" id="1_abc"]
[ext_resource type="PackedScene" path="res://scenes/enemy.tscn" id="2_def"]

[node name="Root" type="Node3D"]
`;

const PARENT_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://scenes/child.tscn" id="1_abc"]
[ext_resource type="Texture2D" path="res://textures/bg.png" id="2_def"]

[node name="Parent" type="Node3D"]
`;

const CHILD_SCENE = `[gd_scene load_steps=1 format=3]

[ext_resource type="Texture2D" path="res://textures/child.png" id="1_xyz"]

[node name="Child" type="Node3D"]
`;

function makeFile(name: string, content = 'x', type = 'application/octet-stream'): File {
  return new File([content], name, { type });
}

describe('pickRootMostTscn', () => {
  it('returns the tscn not referenced by any other tscn in the batch', () => {
    const parent = makeFile('parent.tscn');
    const child = makeFile('child.tscn');
    // parent references child.tscn, so parent is root-most
    const result = pickRootMostTscn([
      { file: parent, text: PARENT_SCENE },
      { file: child, text: CHILD_SCENE },
    ]);
    expect(result.file).toBe(parent);
    expect(result.text).toBe(PARENT_SCENE);
    expect(result.ambiguous).toBe(false);
    // A multi-file pick already parsed the scene — it exposes the paths so the
    // caller's resource matching doesn't re-parse.
    expect(result.extResourcePaths).toEqual([
      'res://scenes/child.tscn',
      'res://textures/bg.png',
    ]);
  });

  it('root-most is found regardless of file order (reversed)', () => {
    const parent = makeFile('parent.tscn');
    const child = makeFile('child.tscn');
    // reversed order — parent is still root-most
    const result = pickRootMostTscn([
      { file: child, text: CHILD_SCENE },
      { file: parent, text: PARENT_SCENE },
    ]);
    expect(result.file).toBe(parent);
    expect(result.ambiguous).toBe(false);
  });

  it('falls back to first when all tscns form a cycle (each references the other)', () => {
    // a.tscn references b.tscn, b.tscn references a.tscn — cycle; fall back to first
    const cycleA = `[gd_scene load_steps=1 format=3]
[ext_resource type="PackedScene" path="res://scenes/b.tscn" id="1"]
[node name="A" type="Node3D"]
`;
    const cycleB = `[gd_scene load_steps=1 format=3]
[ext_resource type="PackedScene" path="res://scenes/a.tscn" id="1"]
[node name="B" type="Node3D"]
`;
    const a = makeFile('a.tscn');
    const b = makeFile('b.tscn');
    const result = pickRootMostTscn([
      { file: a, text: cycleA },
      { file: b, text: cycleB },
    ]);
    expect(result.file).toBe(a);
    expect(result.ambiguous).toBe(true);
  });

  it('flags a tie when several dropped scenes are all unreferenced', () => {
    // Neither scene references the other — two independent roots, so the
    // pick falls back to the first and must be flagged ambiguous.
    const a = makeFile('a.tscn');
    const b = makeFile('b.tscn');
    const result = pickRootMostTscn([
      { file: a, text: CHILD_SCENE },
      { file: b, text: CHILD_SCENE },
    ]);
    expect(result.file).toBe(a);
    expect(result.ambiguous).toBe(true);
  });

  it('returns the single tscn directly', () => {
    const only = makeFile('scene.tscn');
    const result = pickRootMostTscn([{ file: only, text: CHILD_SCENE }]);
    expect(result.file).toBe(only);
    expect(result.text).toBe(CHILD_SCENE);
    expect(result.ambiguous).toBe(false);
    // A single-file pick needs no parse; paths stay null for lazy extraction.
    expect(result.extResourcePaths).toBeNull();
  });

  it('throws on an empty batch', () => {
    expect(() => pickRootMostTscn([])).toThrow('at least one entry');
  });

  it('a reference to a same-named file elsewhere does not disqualify the referencing scene', () => {
    // door.tscn instances res://variants/door.tscn — a DIFFERENT file that
    // happens to share its basename. A scene can't instance itself, so
    // door.tscn must stay the unambiguous root.
    const rootWithSameNameRef = `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="res://variants/door.tscn" id="1"]
[ext_resource type="PackedScene" path="res://child.tscn" id="2"]
[node name="Door" type="Node3D"]
`;
    const door = makeFile('door.tscn');
    const child = makeFile('child.tscn');
    const result = pickRootMostTscn([
      { file: child, text: CHILD_SCENE },
      { file: door, text: rootWithSameNameRef },
    ]);
    expect(result.file).toBe(door);
    expect(result.ambiguous).toBe(false);
  });
});

describe('extResourcePaths', () => {
  it('returns every ExtResource path of a scene', () => {
    expect(extResourcePaths(SCENE_WITH_RESOURCES)).toEqual([
      'res://textures/player.png',
      'res://scenes/enemy.tscn',
    ]);
  });

  it('returns [] for a scene with no external resources', () => {
    expect(extResourcePaths('[gd_scene format=3]\n[node name="Root" type="Node3D"]\n')).toEqual(
      []
    );
  });

  it('returns [] for unparseable text', () => {
    expect(extResourcePaths('not a scene at all')).toEqual([]);
  });
});

describe('matchResourceFiles', () => {
  it('matches a file to its res:// path by basename', () => {
    const file = makeFile('player.png');
    const matches = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [file], new Set());
    expect(matches.matches).toEqual([{ path: 'res://textures/player.png', file }]);
    expect(matches.unmatched).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const file = makeFile('PLAYER.PNG');
    const matches = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [file], new Set());
    expect(matches.matches).toEqual([{ path: 'res://textures/player.png', file }]);
  });

  it('matches multiple files to multiple resource paths', () => {
    const texture = makeFile('player.png');
    const subScene = makeFile('enemy.tscn');
    const result = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [texture, subScene], new Set());
    expect(result.matches).toEqual(
      expect.arrayContaining([
        { path: 'res://textures/player.png', file: texture },
        { path: 'res://scenes/enemy.tscn', file: subScene },
      ])
    );
    expect(result.matches).toHaveLength(2);
  });

  it('ignores a file that matches no external-resource reference and no missing path', () => {
    const unrelated = makeFile('unrelated.png');
    const result = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [unrelated], new Set());
    expect(result.matches).toEqual([]);
    expect(result.unmatched).toEqual([unrelated]);
  });

  it('returns empty matches for an empty file list', () => {
    const result = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [], new Set());
    expect(result.matches).toEqual([]);
    expect(result.unmatched).toHaveLength(0);
  });

  it('matches against missing res:// paths when the file is not in scene ExtResources', () => {
    // A file that matches a missing path but not the scene's direct ExtResources
    const missingFile = makeFile('child.png');
    const missingPaths = new Set(['res://textures/child.png', 'res://textures/other.png']);
    const result = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [missingFile], missingPaths);
    expect(result.matches).toEqual([{ path: 'res://textures/child.png', file: missingFile }]);
  });

  it('prefers direct ExtResource match over missing-list match when both have same basename', () => {
    // player.png is in both ExtResources and missing list
    const file = makeFile('player.png');
    const missingPaths = new Set(['res://other/player.png']);
    const result = matchResourceFiles(extResourcePaths(SCENE_WITH_RESOURCES), [file], missingPaths);
    // Should match the ExtResource path, not the missing path
    expect(result.matches).toEqual([{ path: 'res://textures/player.png', file }]);
  });

  it('matches purely against missing paths with an empty ext-resource list (no scene in the batch)', () => {
    const file = makeFile('child.png');
    const result = matchResourceFiles([], [file], new Set(['res://textures/child.png']));
    expect(result.matches).toEqual([{ path: 'res://textures/child.png', file }]);
    expect(result.unmatched).toHaveLength(0);
  });

  it('leaves every file unmatched with an empty ext-resource list and nothing missing', () => {
    const file = makeFile('child.png');
    const result = matchResourceFiles([], [file], new Set());
    expect(result.matches).toEqual([]);
    expect(result.unmatched).toEqual([file]);
  });

  it('does not report ambiguity for duplicate identical paths in one tier', () => {
    // A scene declaring the same res:// path in two ext_resource headers is
    // one candidate, not a collision.
    const dupScene = `[gd_scene load_steps=3 format=3]
[ext_resource type="Texture2D" path="res://textures/player.png" id="1_a"]
[ext_resource type="Texture2D" path="res://textures/player.png" id="1_b"]
[node name="Root" type="Node3D"]
`;
    const file = makeFile('player.png');
    const result = matchResourceFiles(extResourcePaths(dupScene), [file], new Set());
    expect(result.matches).toEqual([{ path: 'res://textures/player.png', file }]);
    expect(result.ambiguousMatches).toEqual([]);
  });

  it('reports ambiguous match when multiple missing paths share a basename', () => {
    const file = makeFile('player.png');
    // Two missing paths share "player.png" basename — no ExtResource for it
    const missingPaths = new Set([
      'res://textures/player.png',
      'res://other/player.png',
    ]);
    const tscnNoPlayer = `[gd_scene load_steps=1 format=3]
[node name="Root" type="Node3D"]
`;
    const result = matchResourceFiles(extResourcePaths(tscnNoPlayer), [file], missingPaths);
    expect(result.matches).toHaveLength(1);
    expect(result.ambiguousMatches).toHaveLength(1);
    expect(result.ambiguousMatches[0]!.file).toBe(file);
    expect(result.ambiguousMatches[0]!.candidates.length).toBeGreaterThan(1);
  });
});
