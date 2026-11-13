/**
 * A y-sorted TileMapLayer sorts its child nodes with its tile rows, whether the layer is the root
 * of a sort or lifted into a y-sorted parent's flat sort (`renderer_canvas_cull.cpp:110-170`). A
 * y-sorted TileMap sorts the rows of its y-sorted layers with its child nodes the same way.
 */
import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { parseTresFile } from '../parser/parsedResource';
import { NodeDispatcher } from './NodeDispatcher';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { findByType } from '../nodes/2d/tiles/tilemaplayer/findByType.testkit';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import { SceneStack } from './testing/SceneStack';
import { HiddenSeeder } from './testing/HiddenSeeder';
import { visibleInTree } from './visibleInTree';
import type * as THREE from 'three';
import { namesInPaintOrder } from './testing/paintOrder';
import { sceneRoot } from './testing/animationPlayback';
import { seedAtlasTexture } from './testing/seedAtlasTexture';
import { settleLoads } from './testing/settleLoads';

import './nodes/index';

const TILE_SET = `[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="res://tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="atlas"]
texture = ExtResource("1")
texture_region_size = Vector2i(64, 64)
0:0/0 = 0

[resource]
tile_size = Vector2i(64, 64)
sources/0 = SubResource("atlas")
`;

/** Rows 0 to 2 sort at y 32, 96 and 160. The child at y 76 sorts between rows 0 and 1. */
const CELLS: PlacedCell[] = [0, 1, 2].map((y) => ({
  coords: { x: 0, y },
  sourceId: 0,
  atlasCoords: { x: 0, y: 0 },
  alternativeId: 0,
}));

const LAYER_AND_CHILD = (parent: string) => `
[node name="Layer" type="TileMapLayer" parent="${parent}"]
tile_set = ExtResource("1")
y_sort_enabled = true

[node name="Child" type="Polygon2D" parent="${parent === '.' ? 'Layer' : `${parent}/Layer`}"]
position = Vector2(96, 76)
polygon = PackedVector2Array(-80, -70, -20, -70, -20, 30, -80, 30)
`;

const AT_ROOT = `[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[node name="World" type="Node2D"]
${LAYER_AND_CHILD('.')}`;

const LIFTED = `[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[node name="World" type="Node2D"]
y_sort_enabled = true
${LAYER_AND_CHILD('.')}`;

const TILE_MAP = `[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[node name="World" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
y_sort_enabled = true
tile_set = ExtResource("1")
format = 2
layer_0/y_sort_enabled = true
layer_0/tile_data = PackedInt32Array(0, 0, 0, 65536, 0, 0, 131072, 0, 0)

[node name="Child" type="Polygon2D" parent="Map"]
position = Vector2(96, 76)
polygon = PackedVector2Array(-80, -70, -20, -70, -20, 30, -80, 30)
`;

/** Mounts `source` with the layers' cells and the editor eye toggle hiding `hiddenPaths`. */
async function mount(source: string, hiddenPaths: string[] = []) {
  const scene = new TscnParser().parse(source);
  for (const layer of findByType(scene.nodes, 'TileMapLayer')) {
    const props = layer.properties as TileMapLayerProperties;
    props.cells = CELLS;
    props.enabled = true;
  }

  const fake = createFakeResourceLoader();
  fake.resources.seed('res://tiles.tres', parseTresFile(TILE_SET));
  seedAtlasTexture(fake);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={scene}>
      <HiddenSeeder paths={hiddenPaths} />
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
  await settleLoads();
  return sceneRoot(renderer);
}

/** The row and child names in the order three paints them. */
async function drawOrder(source: string): Promise<string[]> {
  return namesInPaintOrder(
    await mount(source),
    (o) => o.name?.startsWith('TileGroup_') || o.name === 'Child'
  ).map((name) => name.replace(/^TileGroup_.*_\d+_(\d+)$/, 'row $1'));
}

/** Whether each row of the layer shows in the scene tree. */
async function rowsVisible(source: string, hiddenPaths: string[]): Promise<boolean[]> {
  const root = await mount(source, hiddenPaths);
  const rows: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name?.startsWith('TileGroup_')) rows.push(o);
  });
  return rows.map(visibleInTree);
}

describe('a y-sorted TileMapLayer with a child node', () => {
  it('draws the child between the rows it sorts between, at the root of a sort', async () => {
    expect(await drawOrder(AT_ROOT)).toEqual(['row 0', 'Child', 'row 1', 'row 2']);
  });

  it('hides the rows with the layer when the editor eye toggle hides it', async () => {
    expect(await rowsVisible(AT_ROOT, [])).toEqual([true, true, true]);
    expect(await rowsVisible(AT_ROOT, ['World/Layer'])).toEqual([false, false, false]);
  });

  it('draws the child between the rows it sorts between, lifted into a y-sorted parent', async () => {
    expect(await drawOrder(LIFTED)).toEqual(['row 0', 'Child', 'row 1', 'row 2']);
  });
});

describe('a y-sorted TileMap with a child node', () => {
  it("draws the child between the rows of the TileMap's y-sorted layer", async () => {
    expect(await drawOrder(TILE_MAP)).toEqual(['row 0', 'Child', 'row 1', 'row 2']);
  });
});
