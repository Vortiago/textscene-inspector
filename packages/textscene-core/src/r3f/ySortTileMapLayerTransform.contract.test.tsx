/**
 * A y-sorted TileMapLayer's rows are child canvas items of the layer, placed at
 * `(0, row y)` in its local space (`tile_map_layer.cpp:352-353`). Each row draws through
 * the layer's whole transform, and sorts by the y of its origin in the sort root's space
 * (`renderer_canvas_cull.cpp:131`, `renderer_canvas_cull.h:115-123`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { parseTresFile } from '../parser/parsedResource';
import { NodeDispatcher } from './NodeDispatcher';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { findByType } from '../nodes/2d/tiles/tilemaplayer/findByType.testkit';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import { SceneStack } from './testing/SceneStack';
import { sceneRoot } from './testing/animationPlayback';
import { compareKeys, paintKey } from './testing/paintOrder';

import './nodes/index';
import { settleLoads } from './testing/settleLoads';

const TILE_SET = `[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="res://tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="atlas"]
texture = ExtResource("1")
texture_region_size = Vector2i(32, 32)
0:0/0 = 0

[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("atlas")
`;

const cellsAt = (coords: readonly [number, number][]): PlacedCell[] =>
  coords.map(([x, y]) => ({ coords: { x, y }, sourceId: 0, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 }));

interface Drawn {
  /** The row groups and `Decor`, in the order three draws them. */
  order: string[];
  /** Each row group's world matrix. */
  rows: Map<string, THREE.Matrix4>;
}

/** A y-sorted `Ground` layer with `layerLines` and `cells`, beside a `Decor` at `decorY`. */
async function draw(layerLines: string, cells: PlacedCell[], decorY = 0): Promise<Drawn> {
  const scene = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Ground" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
y_sort_enabled = true
${layerLines}

[node name="Decor" type="Polygon2D" parent="."]
position = Vector2(0, ${decorY})
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`);
  const props = findByType(scene.nodes, 'TileMapLayer')[0]!.properties as TileMapLayerProperties;
  props.cells = cells;
  props.enabled = true;

  const fake = createFakeResourceLoader();
  fake.resources.seed('res://tiles.tres', parseTresFile(TILE_SET));
  const atlas = new THREE.Texture();
  (atlas as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 32 };
  fake.textures.seed('res://tiles.png', atlas);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
  await settleLoads();

  const root = sceneRoot(renderer);
  root.updateMatrixWorld(true);
  const drawn: { name: string; key: [number, number, number] }[] = [];
  const rows = new Map<string, THREE.Matrix4>();
  root.traverse((o) => {
    if (o.name.startsWith('TileGroup_')) rows.set(o.name, o.matrixWorld.clone());
    if (o.name.startsWith('TileGroup_') || o.name === 'Decor') {
      drawn.push({ name: o.name, key: paintKey(firstMesh(o)) });
    }
  });
  return { order: drawn.sort((a, b) => compareKeys(a.key, b.key)).map((d) => d.name), rows };
}

/** The first mesh drawn under `group`, which three orders by its nearest group's key. */
function firstMesh(group: THREE.Object3D): THREE.Object3D {
  let mesh: THREE.Object3D | undefined;
  group.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o;
  });
  if (!mesh) throw new Error(`expected a mesh under ${group.name}, found none`);
  return mesh;
}

/** Where the Godot layer-local point `(x, y)` lands in Godot canvas space, through `matrix`. */
function godotPoint(matrix: THREE.Matrix4, x: number, y: number): { x: number; y: number } {
  const p = new THREE.Vector3(x, -y, 0).applyMatrix4(matrix);
  return { x: p.x, y: -p.y };
}

describe('a y-sorted TileMapLayer row', () => {
  it('draws through the layer’s rotation', async () => {
    const { rows } = await draw(
      'position = Vector2(100, 0)\nrotation = 1.5707963267948966',
      cellsAt([[1, 0]])
    );
    // The centre of cell (1, 0), (48, 16), turns a quarter to (-16, 48), then moves by (100, 0).
    const centre = godotPoint(rows.get('TileGroup_Ground_0_0')!, 48, 16);
    expect(centre.x).toBeCloseTo(84, 3);
    expect(centre.y).toBeCloseTo(48, 3);
  });

  it('draws through the layer’s scale and skew', async () => {
    const { rows } = await draw('scale = Vector2(2, 0.5)\nskew = 0.3', cellsAt([[1, 0]]));
    // x = 2 * 48 - sin(0.3) * 0.5 * 16, y = cos(0.3) * 0.5 * 16.
    const centre = godotPoint(rows.get('TileGroup_Ground_0_0')!, 48, 16);
    expect(centre.x).toBeCloseTo(93.6358, 3);
    expect(centre.y).toBeCloseTo(7.6427, 3);
  });

  it('sorts by its y through a flipped layer, so the lower local row draws last', async () => {
    // Rows at local y 16 and 48 sit at 84 and 52 under `scale.y = -1`, either side of the Decor.
    const { order } = await draw(
      'position = Vector2(0, 100)\nscale = Vector2(1, -1)',
      cellsAt([
        [0, 0],
        [0, 1],
      ]),
      60
    );
    expect(order).toEqual(['TileGroup_Ground_0_1', 'Decor', 'TileGroup_Ground_0_0']);
  });

  it('keeps the tree order of rows a quarter turn lays on one y', async () => {
    // `cos(-PI/2)` in float is -4.4e-8, so both rows and the Decor tie at y 0 within
    // `is_equal_approx`, and the collection order decides.
    const { order } = await draw(
      'rotation = -1.5707963267948966',
      cellsAt([
        [0, 0],
        [0, 1],
      ])
    );
    expect(order).toEqual(['TileGroup_Ground_0_0', 'TileGroup_Ground_0_1', 'Decor']);
  });
});
