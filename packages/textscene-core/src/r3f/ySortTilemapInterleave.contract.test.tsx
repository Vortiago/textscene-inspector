/**
 * RED contract — Y-sort TileMapLayer PER-Y interleave (the dungeon symptom).
 *
 * The dungeon bug: a decoration that sits between two rows of ground tiles must draw
 * in FRONT of the tiles behind it and BEHIND the tiles in front of it — i.e. its draw
 * order must land BETWEEN the tiles' by Godot Y. This only works if a y-sorted
 * TileMapLayer is decomposed PER Y-GROUP and those groups interleave with sibling
 * nodes in the parent's flat y-sort. Treating the whole layer as ONE unit at its
 * origin Y (all tiles clustered at a single z) fails this — the decoration ends up
 * entirely in front of or behind the whole layer.
 *
 * Setup: a `y_sort_enabled` Floor with a `y_sort_enabled` TileMapLayer (two single-
 * source tiles at Godot local Y = 32 and Y = 160, from the real isometric tileset)
 * plus a `Decor` sibling at the midpoint Y = 96. Assert `Decor`'s accumulated world-z
 * lands strictly BETWEEN the tile groups' world-z. Under the one-unit approximation
 * the tiles cluster at a single z, so `min == max` and nothing can be between → RED.
 *
 * This is the authored contract — do NOT weaken it (do not empty the tile data, do not
 * relax the strict-between assertion to `> 0`). See the plan + operator corrections.
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
    // Assert on the ACTUAL rendered tile MESH (the harm layer), not the
    // `TileGroup_*` wrapper: read the canvas position three would sort the MESH
    // by, which is its nearest enclosing group's. A bug that gave the mesh a
    // canvas key of its own — rather than the local batch index it is supposed
    // to carry — is invisible from the wrapper and only shows here, where the
    // pixels actually are. The batched tile mesh is an anonymous child of its
    // `TileGroup_<name>_<i>` group.
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
    // THE PIN: the decoration's draw order lands strictly BETWEEN the tile ROWS as
    // rendered (the meshes). Two failure modes this catches: (1) the one-unit
    // approximation clusters all tiles at a single z (min === max) → nothing between;
    // (2) the tile mesh double-counts its rank (mesh at 2×rank while the decoration is
    // at 1×rank) → the near tile row coincides with / overtakes the decoration.
    expect(Math.min(...tileZ)).toBeLessThan(decorZ!);
    expect(decorZ!).toBeLessThan(Math.max(...tileZ));
  });

  it('keeps every expanded tile row inside the y-sort subtree\'s own draw-sequence run', async () => {
    // A y-sorted layer expands into one group PER ROW, and those rows are what
    // the layer's own reserve was held back for (`canvasPaintOrder.ts`). Sizing
    // each row by the layer node it names would claim a fresh reserve per row
    // and run off the end of the enclosing subtree's run — where the next
    // SIBLING lives, so the whole tilemap would climb over it. Nothing in the
    // interleave above notices that: it only compares rows against a decoration
    // INSIDE the same subtree, which is carried along by the same overflow.
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
