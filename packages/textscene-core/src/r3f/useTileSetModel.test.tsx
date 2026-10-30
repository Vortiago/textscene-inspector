/** A tile node's `tile_set` read from a scene's sub-resource or from the TileSet's own file. */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { parseTresFile } from '../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { useTileSetModel } from './useTileSetModel';
import '../resources/formats/binaryresource/index';

const TILESET = parseTresFile(`[gd_resource type="TileSet" format=3]

[resource]
tile_size = Vector2i(16, 16)
`);

const EXTERNALS: TscnExternalResource[] = [
  { id: 'text', type: 'TileSet', path: 'res://tiles.tres' },
  // The binary reader parses a `.res` to the ParsedResource a `.tres` gives.
  { id: 'binary', type: 'TileSet', path: 'res://tiles.res' },
  { id: 'image', type: 'TileSet', path: 'res://tiles.png' },
];

function tileSetOf(ref: string) {
  const fake = createFakeResourceLoader();
  fake.resources.seed('res://tiles.tres', TILESET);
  fake.resources.seed('res://tiles.res', TILESET);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={EXTERNALS}>
        {children}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return renderHook(() => useTileSetModel(ref), { wrapper }).result.current;
}

describe('useTileSetModel', () => {
  it('reads a TileSet from its .tres', () => {
    expect(tileSetOf('ExtResource("text")').status).toBe('loaded');
  });

  it('reads a TileSet saved as a binary .res', () => {
    expect(tileSetOf('ExtResource("binary")').status).toBe('loaded');
  });

  it('gives no TileSet for a path no resource file has (error case)', () => {
    expect(tileSetOf('ExtResource("image")')).toEqual({ model: null, status: 'unavailable' });
  });
});

/**
 * `create_tile` needs room in the atlas grid of the texture's size (`tile_set.cpp:4985`, `:5200-5211`),
 * and a ViewportTexture reports size 0 while the scene loads (`viewport.cpp:156-160`), saved in its
 * own file too.
 */
describe('useTileSetModel over a ViewportTexture file', () => {
  const VIEWPORT_TEXTURE = parseTresFile(`[gd_resource type="ViewportTexture" format=3]

[resource]
resource_local_to_scene = true
viewport_path = NodePath("SubViewport")
`);
  const externals: TscnExternalResource[] = [{ id: 'vt', type: 'Texture2D', path: 'res://viewport.tres' }];
  const internals: TscnInternalResource[] = [
    { id: 'atlas', type: 'TileSetAtlasSource', data: { texture: 'ExtResource("vt")', '0:0/0': '0' } },
    { id: 'ts', type: 'TileSet', data: { 'sources/0': 'SubResource("atlas")' } },
  ];

  function sceneTileSet(isFileSeeded: boolean) {
    const fake = createFakeResourceLoader();
    if (isFileSeeded) fake.resources.seed('res://viewport.tres', VIEWPORT_TEXTURE);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={internals} externalResources={externals}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    return renderHook(() => useTileSetModel('SubResource("ts")'), { wrapper }).result.current;
  }

  it('creates no tile in the atlas, as Godot finds no room at load', () => {
    expect(sceneTileSet(true).model!.sources.get(0)!.tiles.size).toBe(0);
  });

  it('waits for the file before it creates any tile', () => {
    expect(sceneTileSet(false)).toEqual({ model: null, status: 'pending' });
  });
});
