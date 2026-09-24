/**
 * A y-sorted TileMapLayer splits into one group per Y row, and the rows interleave
 * with sibling nodes in the parent's flat y-sort. A `Decor` between two tile rows of
 * the isometric tileset draws in front of the row behind it and behind the row in
 * front. Keep the tile data and the strict-between assertion.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { nearestGroupOrder } from './testing/paintOrder';
import { parseTresFile } from '../parser/parsedResource';
import { tileSetFromTres } from '../resources/tileset/decode';
import { mapToLocalPx } from '../resources/tileset/tilePlacement';
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

/** Collect world-z for every named object, plus world-z of every `tilegroup:*` group. */
async function render(cells: PlacedCell[], decorY: number) {
  const tscn = `[gd_scene format=3]
[ext_resource type="TileSet" uid="uid://tset" path="res://tileset/tileset.tres" id="1"]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Ground" type="TileMapLayer" parent="Floor"]
tile_set = ExtResource("1")
y_sort_enabled = true
y_sort_origin = 0

[node name="Decor" type="Polygon2D" parent="Floor"]
position = Vector2(0, ${decorY})
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="After" type="Polygon2D" parent="."]
position = Vector2(0, 0)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;
  const scene = new TscnParser().parse(tscn);
  const ground = findByType(scene.nodes, 'TileMapLayer')[0]!;
  const gp = ground.properties as TileMapLayerProperties;
  gp.cells = cells;
  gp.enabled = true;

  const fake = createFakeResourceLoader();
  fake.resources.seed('res://tileset/tileset.tres', parseTresFile(tilesetContent));
  const atlasTex = new THREE.Texture();
  (atlasTex as unknown as { image: { width: number; height: number } }).image = { width: 1024, height: 1024 };
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

  const tileZ: number[] = [];
  let decorZ: number | undefined;
  let afterZ: number | undefined;
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  root?.traverse((o: THREE.Object3D) => {
    // Read the rendered tile mesh, an anonymous child of `TileGroup_<name>_<i>`, at the
    // order three sorts it by (its nearest group's), not the wrapper's: a mesh with a
    // canvas key of its own, not its local batch index, shows only here.
    if (o.name?.startsWith('TileGroup_')) {
      o.traverse((m: THREE.Object3D) => {
        if ((m as THREE.Mesh).isMesh) tileZ.push(nearestGroupOrder(m));
      });
    } else if (o.name === 'Decor') {
      decorZ = o.renderOrder;
    } else if (o.name === 'After') {
      afterZ = o.renderOrder;
    }
  });
  return { tileZ, decorZ, afterZ };
}

describe('Y-sort TileMapLayer per-Y interleave (issue #74 dungeon symptom)', () => {
  it('a decoration between two tile rows draws BETWEEN the tile groups by Y', async () => {
    const model = tileSetFromTres(parseTresFile(tilesetContent))!;
    // Two single-source cells at distinct Godot local Y (DIAMOND_DOWN 128x64).
    const yLow = mapToLocalPx(model, { x: 0, y: 0 }).y; // 32
    const yHigh = mapToLocalPx(model, { x: 0, y: 4 }).y; // 160
    expect(yLow).toBeLessThan(yHigh);
    const cells: PlacedCell[] = [
      { coords: { x: 0, y: 0 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
      { coords: { x: 0, y: 4 }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 },
    ];
    const decorY = (yLow + yHigh) / 2; // 96, strictly between the two tile rows

    const { tileZ, decorZ } = await render(cells, decorY);

    // Both tile meshes and the decoration rendered.
    expect(tileZ.length).toBeGreaterThan(0);
    expect(decorZ).toBeDefined();
    // The decoration lands strictly between the rendered tile rows. This fails when the
    // layer is one unit (min === max), or when the mesh counts its rank twice and the
    // near row overtakes the decoration.
    expect(Math.min(...tileZ)).toBeLessThan(decorZ!);
    expect(decorZ!).toBeLessThan(Math.max(...tileZ));
  });

  it('keeps every expanded tile row inside the y-sort subtree\'s own draw-sequence run', async () => {
    // The rows share the layer's own reserve (`canvasPaintOrder.ts`). A fresh reserve
    // per row runs off the subtree's run into the next sibling's, which the test above
    // misses: its decoration sits inside the same subtree and overflows with it.
    const model = tileSetFromTres(parseTresFile(tilesetContent))!;
    const cells: PlacedCell[] = [0, 2, 4, 6, 8].map((y) => ({
      coords: { x: 0, y },
      sourceId: 0,
      atlasCoords: { x: 0, y: 0 },
      alternativeId: 0,
    }));
    const { tileZ, afterZ } = await render(cells, mapToLocalPx(model, { x: 0, y: 1 }).y);

    expect(tileZ.length).toBeGreaterThan(1);
    expect(afterZ).toBeDefined();
    expect(Math.max(...tileZ)).toBeLessThan(afterZ!);
  });
});
