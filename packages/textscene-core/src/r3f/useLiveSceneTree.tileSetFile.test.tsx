/**
 * The live tree requests a tile layer's TileSet file itself: a `.tres` TileSet adds its scene tiles
 * as live children of the layer with no tile component mounted, once the tree's own request loads it.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoader } from '../resources/ResourceLoader.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { busServing } from '../resources/testing/servingFileBus.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useLiveNode } from './useLiveSceneTree.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { useTileSetModel } from './useTileSetModel.js';
import './nodes/index';

const CRATE = `[gd_scene format=3]

[node name="Crate" type="Node2D"]
`;

const TILE_SET_FILE = `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://crate.tscn" id="crate"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("crate")

[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("scenes")
`;

/** The format header, then one cell at (0, 0) naming scene tile 1 of source 0 (`tile_map_layer.cpp:2393-2416`). */
const ONE_CELL = 'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0)';

const MAIN = `[gd_scene load_steps=2 format=3]

[ext_resource type="TileSet" path="res://tiles.tres" id="tiles"]

[node name="World" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_map_data = ${ONE_CELL}
tile_set = ExtResource("tiles")
`;

const SCENE_TILE = 'World/Layer/@SceneTile@0_0';

/** Enough timer ticks for a file read through the bus, and the run it starts, to finish. */
const SETTLE_TICKS = 5;

async function settle() {
  for (let tick = 0; tick < SETTLE_TICKS; tick++) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
  }
}

/** A loader over the TileSet file and the tile's scene, and a wrapper with `MAIN` in context. */
function mount() {
  const { bus, provider, loads } = busServing({
    'res://tiles.tres': TILE_SET_FILE,
    'res://crate.tscn': CRATE,
  });
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  // The tree's own reads of scenes stay with their consumers, so the test requests the tile's scene.
  loader.scenes.request('res://crate.tscn');
  const main = new TscnParser().parse(MAIN);
  const sceneGraph = createSceneGraphFromTscnScene(main);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider externalResources={main.externalResources}>{children}</SceneResourcesProvider>
      </ResourceLoaderProvider>
    </HierarchyProvider>
  );
  const tileSetLoads = () => loads.filter((path) => path === 'res://tiles.tres').length;
  return { wrapper, tileSetLoads };
}

describe('the live tree over a TileSet file', () => {
  it('adds the scene tiles of a .tres TileSet with no tile component mounted', async () => {
    const { wrapper, tileSetLoads } = mount();

    const { result } = renderHook(() => useLiveNode(SCENE_TILE), { wrapper });
    await settle();

    expect(tileSetLoads()).toBe(1);
    expect(result.current?.node.name).toBe('@SceneTile@0_0');
  });

  it('loads the TileSet once for the tree and the tile component, and answers both with one model', async () => {
    const { wrapper, tileSetLoads } = mount();

    const { result } = renderHook(
      () => ({ tile: useLiveNode(SCENE_TILE), tileSet: useTileSetModel('ExtResource("tiles")') }),
      { wrapper }
    );
    await settle();

    expect(tileSetLoads()).toBe(1);
    expect(result.current.tile?.node.name).toBe('@SceneTile@0_0');
    expect(result.current.tileSet.status).toBe('loaded');
  });
});
