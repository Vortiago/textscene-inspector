/**
 * Two same-named y-sorted TileMapLayers in one flat sort must each render every
 * one of their Y-groups.
 *
 * The flat list is keyed per item, and a Y-group is not a tree position: two
 * layers that share a name and land on overlapping numbering hand React the
 * same key twice inside one `.map()`, which keeps a single child. The symptom
 * is a whole tile row of one room missing, and remounting on every re-sort.
 *
 * Duplicate node names are legal here — Godot only makes a name unique among
 * its OWN siblings, so two rooms may each hold a `Floor`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const here = dirname(fileURLToPath(import.meta.url));
const isoRoot = resolve(here, '../../../../scenes/isometric');
const tilesetContent = readFileSync(resolve(isoRoot, 'tileset/tileset.tres'), 'utf8');

const cellsAt = (rows: number[]): PlacedCell[] =>
  rows.map((y) => ({
    coords: { x: 0, y },
    sourceId: 0,
    atlasCoords: { x: 0, y: 0 },
    alternativeId: 0,
  }));

/** Every `TileGroup_*` object name in the rendered graph, in traversal order. */
async function renderTwoRooms(roomA: number[], roomB: number[]) {
  const tscn = `[gd_scene format=3]
[ext_resource type="TileSet" uid="uid://tset" path="res://tileset/tileset.tres" id="1"]

[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="RoomA" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Floor" type="TileMapLayer" parent="RoomA"]
tile_set = ExtResource("1")
y_sort_enabled = true

[node name="RoomB" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Floor" type="TileMapLayer" parent="RoomB"]
tile_set = ExtResource("1")
y_sort_enabled = true
`;
  const scene = new TscnParser().parse(tscn);
  const layers = findByType(scene.nodes, 'TileMapLayer');
  expect(layers).toHaveLength(2);
  for (const [i, cells] of [roomA, roomB].entries()) {
    const props = layers[i]!.properties as TileMapLayerProperties;
    props.cells = cellsAt(cells);
    props.enabled = true;
  }

  const fake = createFakeResourceLoader();
  fake.resources.seed('res://tileset/tileset.tres', parseTresFile(tilesetContent));
  const atlasTex = new THREE.Texture();
  (atlasTex as unknown as { image: { width: number; height: number } }).image = {
    width: 1024,
    height: 1024,
  };
  fake.textures.seed('res://tileset/isotiles.png', atlasTex);

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
  const names: string[] = [];
  root?.traverse((o: THREE.Object3D) => {
    if (o.name?.startsWith('TileGroup_')) names.push(o.name);
  });
  return names;
}

describe('same-named y-sorted TileMapLayers in one flat sort', () => {
  it('renders every Y-group of both layers', async () => {
    // Three rows in the first room, two in the second: enough for the first
    // layer's numbering to reach the second layer's.
    const names = await renderTwoRooms([0, 4, 8], [0, 4]);

    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
  });
});
