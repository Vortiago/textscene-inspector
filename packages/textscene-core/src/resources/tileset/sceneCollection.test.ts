/**
 * The decode of a `TileSetScenesCollectionSource`: each scene id with its PackedScene reference
 * and `display_placeholder`, in a scene's SubResource and in an external TileSet file.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as logger from '../../logger';
import { tileSetFromFile, tileSetFromScene } from './decode';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const externals: TscnExternalResource[] = [
  { id: '5', type: 'PackedScene', path: 'res://tile.tscn' },
  { id: '6', type: 'Texture2D', path: 'res://icon.png' },
];

function tileSetWith(sceneSource: Record<string, string>) {
  const internals: TscnInternalResource[] = [
    { id: 'scenes', type: 'TileSetScenesCollectionSource', data: sceneSource },
    { id: 'ts', type: 'TileSet', data: { 'sources/2': 'SubResource("scenes")' } },
  ];
  return { internals, model: tileSetFromScene('SubResource("ts")', internals, externals)! };
}

describe('a TileSetScenesCollectionSource in a scene', () => {
  it('decodes each scene id with its scene reference and the tables the reference resolves in', () => {
    const { internals, model } = tileSetWith({ 'scenes/1/scene': 'ExtResource("5")' });
    expect(model.sceneSources.get(2)!.scenes.get(1)).toEqual({
      scene: { ref: 'ExtResource("5")', externalResources: externals, internalResources: internals },
      displayPlaceholder: false,
    });
  });

  it('gives the tiles that name one scene the same scene object', () => {
    const { model } = tileSetWith({
      'scenes/1/scene': 'ExtResource("5")',
      'scenes/2/scene': 'ExtResource("5")',
    });
    const { scenes } = model.sceneSources.get(2)!;
    expect(scenes.get(1)!.scene).toBe(scenes.get(2)!.scene);
  });

  it.each([
    ['an ExtResource that is no PackedScene', 'ExtResource("6")'],
    ['an ExtResource the file lacks', 'ExtResource("9")'],
  ])('gives a tile no scene for %s', (_name, reference) => {
    const { model } = tileSetWith({ 'scenes/1/scene': reference });
    expect(model.sceneSources.get(2)!.scenes.get(1)!.scene).toBeNull();
  });

  it('reads display_placeholder beside the scene', () => {
    const { model } = tileSetWith({
      'scenes/1/scene': 'ExtResource("5")',
      'scenes/1/display_placeholder': 'true',
    });
    expect(model.sceneSources.get(2)!.scenes.get(1)!.displayPlaceholder).toBe(true);
  });

  it('makes a scene tile with no scene of a key that names only display_placeholder (tile_set.cpp:5883-5886)', () => {
    const { model } = tileSetWith({ 'scenes/3/display_placeholder': 'true' });
    expect(model.sceneSources.get(2)!.scenes.get(3)).toEqual({ scene: null, displayPlaceholder: true });
  });

  it('holds a null scene as a scene tile with no scene', () => {
    const { model } = tileSetWith({ 'scenes/1/scene': 'null' });
    expect(model.sceneSources.get(2)!.scenes.get(1)!.scene).toBeNull();
  });

  it('keeps the scene source out of the atlas sources', () => {
    const { model } = tileSetWith({ 'scenes/1/scene': 'ExtResource("5")' });
    expect(model.sources.has(2)).toBe(false);
  });

  it('re-seats a negative scene id at next_scene_id (tile_set.cpp:5781-5783)', () => {
    const { model } = tileSetWith({ 'scenes/-4/scene': 'ExtResource("5")' });
    expect([...model.sceneSources.get(2)!.scenes.keys()]).toEqual([1]);
    expect(model.sceneSources.get(2)!.scenes.get(1)!.scene).not.toBeNull();
  });

  it('seats a negative id past the ids already taken, in the order of the keys', () => {
    const { model } = tileSetWith({
      'scenes/1/scene': 'ExtResource("5")',
      'scenes/-1/scene': 'ExtResource("5")',
      'scenes/2/scene': 'ExtResource("5")',
    });
    // Tile 1 is taken, so the negative id lands on 2 (`:5739-5743`). Id 2 then exists, so the
    // later `scenes/2/scene` sets that tile's scene instead of creating one.
    expect([...model.sceneSources.get(2)!.scenes.keys()].sort()).toEqual([1, 2]);
  });

  it('loses the placeholder flag of a negative id, which names no tile (tile_set.cpp:5844-5845)', () => {
    const { model } = tileSetWith({ 'scenes/-1/display_placeholder': 'true' });
    expect(model.sceneSources.get(2)!.scenes.get(1)).toEqual({ scene: null, displayPlaceholder: false });
  });

  it('still warns for a source type it does not know', () => {
    const internals: TscnInternalResource[] = [
      { id: 'odd', type: 'TileSetMysterySource', data: {} },
      { id: 'ts', type: 'TileSet', data: { 'sources/0': 'SubResource("odd")' } },
    ];
    tileSetFromScene('SubResource("ts")', internals, externals);
    expect(
      warnSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('unsupported source type'))
    ).toBe(true);
  });
});

describe('a TileSetScenesCollectionSource in an external TileSet file', () => {
  it('resolves the scene in the file own ExtResource table', () => {
    const parsed = parseTresFile(`[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://from_tres.tscn" id="1_abc"]

[sub_resource type="TileSetScenesCollectionSource" id="TileSetScenesCollectionSource_a"]
scenes/1/scene = ExtResource("1_abc")

[resource]
sources/0 = SubResource("TileSetScenesCollectionSource_a")
`);
    const scene = tileSetFromFile(parsed, 'res://tileset.tres')!.sceneSources.get(0)!.scenes.get(1)!.scene!;
    expect(scene.ref).toBe('ExtResource("1_abc")');
    expect(scene.externalResources.map((resource) => resource.path)).toEqual(['res://from_tres.tscn']);
  });
});
