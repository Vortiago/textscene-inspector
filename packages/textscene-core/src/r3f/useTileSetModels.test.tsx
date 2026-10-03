/**
 * `useTileSetModels`: one resolution per distinct `tile_set`. A y-sort root can hold
 * layers with different tilesets, and one shared grid puts a layer's rows at the
 * wrong tile pitch, so their sort Y lands where no sibling expects it.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('requests its TileSet when the file arrives, though the cache no longer holds its failure', () => {
    const fake = createFakeResourceLoader();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXTERNALS}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    renderHook(() => useTileSetModels(['ExtResource("1_floor")']), { wrapper });
    const requested: string[] = [];
    fake.resources.setRequestImpl((path) => requested.push(path));

    act(() => fake.loader.provideFile(FLOOR_PATH));

    expect(requested).toEqual([FLOOR_PATH]);
  });

  it('requests its TileSet again when the file changes, and keeps the old model until the new one arrives', async () => {
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
    const requested: string[] = [];
    fake.resources.setRequestImpl((path) => requested.push(path));

    act(() => fake.loader.provideFile(FLOOR_PATH));

    expect(requested).toContain(FLOOR_PATH);
    expect(result.current('ExtResource("1_floor")').model?.tileSize).toEqual({ x: 16, y: 16 });

    act(() => fake.resources._resolve(FLOOR_PATH, parseTresFile(tilesetTres(64))));

    expect(result.current('ExtResource("1_floor")').model?.tileSize).toEqual({ x: 64, y: 64 });
  });
});
