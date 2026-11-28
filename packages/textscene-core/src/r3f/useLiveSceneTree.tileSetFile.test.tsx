/**
 * The live tree requests a tile layer's TileSet file itself: a `.tres` TileSet adds its scene tiles
 * as live children of the layer with no tile component mounted, once the tree's own request loads it.
 * The tile component reads the same file on the same live files, so both give one answer in each state.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoader } from '../resources/ResourceLoader.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { busServing } from '../resources/testing/servingFileBus.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useBuildSolveTree } from './controls/native/buildSolveTree.js';
import { useLiveStepOf } from './useLiveSceneTree.js';
import { useLiveNode } from './liveNode.testkit.js';
import { liveFilesOf } from './liveFiles.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { nodeReference } from '../resources/reading/scopedReference.js';
import { TILE_SET } from '../resources/tileset/kind.js';
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

const TILE_SET_PATH = 'res://tiles.tres';

/**
 * A loader over the tile's scene and `tileSetFile` (null: the file is missing), and a wrapper with
 * `MAIN` in context. `isTileSetHeld` keeps the TileSet loading.
 */
function mount(tileSetFile: string | null = TILE_SET_FILE, isTileSetHeld = false, sceneText = MAIN) {
  const files: Record<string, string> = { 'res://crate.tscn': CRATE };
  if (tileSetFile !== null) files[TILE_SET_PATH] = tileSetFile;
  const { bus, provider, loads } = busServing(files, isTileSetHeld ? [TILE_SET_PATH] : []);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  // The tree's own reads of scenes stay with their consumers, so the test requests the tile's scene.
  loader.scenes.request('res://crate.tscn');
  const main = new TscnParser().parse(sceneText);
  const sceneGraph = createSceneGraphFromTscnScene(main);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          externalResources={main.externalResources}
          internalResources={main.internalResources}
        >
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </HierarchyProvider>
  );
  const tileSetLoads = () => loads.filter((path) => path === TILE_SET_PATH).length;
  return { wrapper, tileSetLoads, liveFiles: liveFilesOf(loader), main };
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

  it.each(['live tree', 'Control forest'])('shares a built-in TileSet model with the %s', async (reader) => {
    const scene = MAIN.replace(
      '[ext_resource type="TileSet" path="res://tiles.tres" id="tiles"]',
      '[sub_resource type="TileSet" id="tiles"]\ntile_size = Vector2i(32, 32)'
    ).replace('ExtResource("tiles")', 'SubResource("tiles")');
    const { wrapper, main, liveFiles } = mount(null, false, scene);
    const decode = vi.spyOn(TILE_SET, 'decode');
    try {
      if (reader === 'live tree') renderHook(() => useLiveNode(SCENE_TILE), { wrapper });
      else
        renderHook(() => useBuildSolveTree(main.nodes, main.externalResources, main.internalResources), {
          wrapper,
        });
      await settle();
      expect(decode).toHaveBeenCalledOnce();
      const treeModel = decode.mock.results[0]!.value;
      const reparsed = new TscnParser().parse(scene);
      expect(liveFiles.current().read(nodeReference('SubResource("tiles")', reparsed), TILE_SET).value).toBe(
        treeModel
      );
      const component = renderHook(() => useTileSetModel('SubResource("tiles")'), { wrapper });

      expect(component.result.current.model).toBe(treeModel);
    } finally {
      decode.mockRestore();
    }
  });

  it('reads the TileSet of a tile component on the live files of the tree', async () => {
    const { wrapper, liveFiles } = mount();

    renderHook(() => useTileSetModel('ExtResource("tiles")'), { wrapper });
    await settle();

    expect(liveFiles.files().has(TILE_SET_PATH)).toBe(true);
  });

  it.each([
    { state: 'loading', file: TILE_SET_FILE, isHeld: true, status: 'pending', hasTile: false },
    { state: 'missing', file: null, isHeld: false, status: 'unavailable', hasTile: false },
    { state: 'not parsed', file: 'not a resource', isHeld: false, status: 'unavailable', hasTile: false },
    { state: 'loaded', file: TILE_SET_FILE, isHeld: false, status: 'loaded', hasTile: true },
  ])('gives the tree and the tile component one answer for a $state TileSet', async (row) => {
    const { wrapper, liveFiles } = mount(row.file, row.isHeld);

    const { result } = renderHook(
      () => ({ tile: useLiveNode(SCENE_TILE), tileSet: useTileSetModel('ExtResource("tiles")') }),
      { wrapper }
    );
    await settle();

    expect(result.current.tileSet.status).toBe(row.status);
    expect(result.current.tile !== null).toBe(row.hasTile);
    expect(liveFiles.files().size).toBe(1);
  });

  it('builds the tree again for a TileSet that loaded unheard after a second tree read it loaded', async () => {
    const { wrapper, main } = mount();
    const layer = main.nodes[0]!.children.find((node) => node.name === 'Layer')!;
    const scope = { externalResources: main.externalResources, internalResources: main.internalResources };
    await settle();
    // The shared tree reads the TileSet while it loads, and its reader leaves before the load lands.
    renderHook(() => useLiveNode(SCENE_TILE), { wrapper }).unmount();
    await settle();

    renderHook(() => useLiveStepOf(layer, scope), { wrapper });
    const { result } = renderHook(() => useLiveNode(SCENE_TILE), { wrapper });
    await settle();

    expect(result.current?.node.name).toBe('@SceneTile@0_0');
  });
});
