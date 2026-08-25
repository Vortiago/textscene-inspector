/**
 * `useTileSetModels` — one resolution per DISTINCT `tile_set`.
 *
 * A y-sort root routinely holds several `TileMapLayer`s with different tilesets
 * (a 16x16 floor and a 32x32 prop sheet, say). A hook cannot be called in a
 * loop, so the y-sort expansion used to resolve the FIRST layer's tileset and
 * bucket every layer's cells against that grid — right art at the wrong tile
 * pitch, which puts those rows' sort Y where no sibling expects them.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { parseTresFile } from '../parser/parsedResource';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { useTileSetModels } from './useTileSetModel';

const FLOOR_PATH = 'res://tiles/floor.tres';
const PROPS_PATH = 'res://tiles/props.tres';

function tilesetTres(size: number): string {
  return `[gd_resource type="TileSet" format=3]

[resource]
tile_size = Vector2i(${size}, ${size})
`;
}

const EXTERNALS = [
  { id: '1_floor', path: FLOOR_PATH, type: 'TileSet' },
  { id: '2_props', path: PROPS_PATH, type: 'TileSet' },
];

describe('useTileSetModels', () => {
  it('gives each ref its OWN model rather than the first one it found', async () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(FLOOR_PATH, parseTresFile(tilesetTres(16)));
    fake.resources.seed(PROPS_PATH, parseTresFile(tilesetTres(32)));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXTERNALS}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const refs = ['ExtResource("1_floor")', 'ExtResource("2_props")'];
    const { result } = renderHook(() => useTileSetModels(refs), { wrapper });

    await waitFor(() => {
      expect(result.current('ExtResource("1_floor")').model?.tileSize).toEqual({ x: 16, y: 16 });
    });
    expect(result.current('ExtResource("2_props")').model?.tileSize).toEqual({ x: 32, y: 32 });
  });

  it('reports an unknown ref as unavailable rather than borrowing a resolved one', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(FLOOR_PATH, parseTresFile(tilesetTres(16)));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXTERNALS}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const { result } = renderHook(() => useTileSetModels(['ExtResource("1_floor")']), { wrapper });
    expect(result.current(undefined).model).toBeNull();
    expect(result.current('ExtResource("9_nope")').status).toBe('unavailable');
  });
});
