/**
 * Two y-sorted TileMapLayers naming DIFFERENT TileSets must each bucket their
 * rows against their own tile pitch.
 *
 * A row's sort key is `map_to_local(cell).y`, which scales with the grid's
 * `tile_size`. Expanding every layer against one grid puts the coarser layer's
 * rows at the finer layer's pitch, so the two interleave at the wrong depths —
 * while `TileGroupRenderer` re-resolves per layer and draws each row from the
 * right model. The sorter and the renderer would disagree about the same rows.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { parseTresFile } from '../parser/parsedResource';
import { NodeDispatcher } from './NodeDispatcher';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { findByType } from '../nodes/2d/tiles/tilemaplayer/findByType';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';

import './nodes/index';

/** A square TileSet of the given pitch. No sources: the sort only reads the grid. */
const squareTileSet = (size: number) => `[gd_resource type="TileSet" format=3]

[resource]
tile_size = Vector2i(${size}, ${size})
`;

const cellsAt = (rows: number[]): PlacedCell[] =>
  rows.map((y) => ({ coords: { x: 0, y }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 }));

/**
 * `TileGroup_*` names in draw order — the rank the y-sort pass assigned, read
 * back off each group's own z rather than off traversal order.
 */
async function drawOrder(): Promise<string[]> {
  const scene = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="TileSet" path="res://small.tres" id="1"]
[ext_resource type="TileSet" path="res://big.tres" id="2"]

[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Small" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
y_sort_enabled = true

[node name="Big" type="TileMapLayer" parent="."]
tile_set = ExtResource("2")
y_sort_enabled = true
`);
  const layers = findByType(scene.nodes, 'TileMapLayer');
  expect(layers).toHaveLength(2);
  // 32px rows at y=0,4 sort to 16 and 144; 64px rows at y=1,2 sort to 96 and
  // 160, which interleaves them. Against the 32px grid the same two rows sort
  // to 48 and 80 and both fall BELOW the small layer's second row.
  for (const [i, rows] of [[0, 4], [1, 2]].entries()) {
    const props = layers[i]!.properties as TileMapLayerProperties;
    props.cells = cellsAt(rows);
    props.enabled = true;
  }

  const fake = createFakeResourceLoader();
  fake.resources.seed('res://small.tres', parseTresFile(squareTileSet(32)));
  fake.resources.seed('res://big.tres', parseTresFile(squareTileSet(64)));

  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));

  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  const groups: Array<{ name: string; z: number }> = [];
  root?.traverse((o: THREE.Object3D) => {
    if (o.name?.startsWith('TileGroup_')) groups.push({ name: o.name, z: o.position.z });
  });
  return groups.sort((a, b) => a.z - b.z).map((g) => g.name);
}

describe('y-sorted TileMapLayers with different TileSets', () => {
  it('interleaves each layer at its own tile pitch', async () => {
    expect(await drawOrder()).toEqual([
      'TileGroup_Small_0_0',
      'TileGroup_Big_1_0',
      'TileGroup_Small_0_1',
      'TileGroup_Big_1_1',
    ]);
  });
});
