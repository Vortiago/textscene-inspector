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

const externals: TscnExternalResource[] = [{ id: '5', type: 'PackedScene', path: 'res://tile.tscn' }];

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

  it('drops a negative scene id, which create_scene_tile re-seats (tile_set.cpp:5781-5783)', () => {
    const { model } = tileSetWith({ 'scenes/-4/scene': 'ExtResource("5")' });
    expect(model.sceneSources.get(2)!.scenes.size).toBe(0);
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
