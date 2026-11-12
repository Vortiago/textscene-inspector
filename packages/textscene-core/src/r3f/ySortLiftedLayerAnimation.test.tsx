/**
 * An AnimationPlayer track on a y-sorted TileMapLayer that sits in a y-sorted parent's flat sort
 * moves every row of the layer, and the rows re-sort against the layer's siblings on the frame
 * the mixer moves it (ADR-0011, ADR-0070).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { FakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { parseTresFile } from '../parser/parsedResource';
import { mountWithPlayer, play, sceneRoot, stop } from './testing/animationPlayback';
import { namesInPaintOrder } from './testing/paintOrder';
import { seedAtlasTexture } from './testing/seedAtlasTexture';
import { settleLoads } from './testing/settleLoads';

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

/**
 * Rows 0 to 2 of `Layer` sort at y 32, 96 and 160 and `Bar` at y 110. The layer slides down by
 * 200 in one second, so at 0.5 s its rows sit at 132, 196 and 260, all below `Bar`.
 */
const SCENE = `[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[sub_resource type="Animation" id="Slide"]
resource_name = "slide"
length = 1.0
tracks/0/type = "value"
tracks/0/path = NodePath("Layer:position")
tracks/0/interp = 1
tracks/0/keys = {
"times": PackedFloat32Array(0, 1),
"transitions": PackedFloat32Array(1, 1),
"update": 0,
"values": [Vector2(0, 0), Vector2(0, 200)]
}

[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"slide": SubResource("Slide")
}

[node name="World" type="Node2D"]
y_sort_enabled = true

[node name="Layer" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
y_sort_enabled = true
tile_map_data = PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0)

[node name="Bar" type="Polygon2D" parent="."]
position = Vector2(0, 110)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Player" type="AnimationPlayer" parent="."]
libraries/ = SubResource("Lib")
`;

function seedTileSet(fake: FakeResourceLoader): void {
  fake.resources.seed('res://tiles.tres', parseTresFile(TILE_SET));
  seedAtlasTexture(fake);
}

/** The row and `Bar` names in the order three paints them. */
function drawOrder(root: THREE.Object3D): string[] {
  return namesInPaintOrder(root, (o) => o.name.startsWith('TileGroup_') || o.name === 'Bar').map((name) =>
    name.replace(/^TileGroup_.*_\d+_(\d+)$/, 'row $1')
  );
}

async function mount() {
  const mounted = await mountWithPlayer(SCENE, 'World/Player', { workspace: '2d', seed: seedTileSet });
  await settleLoads();
  return mounted;
}

describe('an AnimationPlayer track on a y-sorted TileMapLayer in a y-sorted parent', () => {
  it('moves every row of the layer', async () => {
    const { renderer } = await mount();
    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    const root = sceneRoot(renderer);
    root.updateMatrixWorld(true);
    const rowYs: number[] = [];
    root.traverse((o) => {
      if (o.name.startsWith('TileGroup_'))
        rowYs.push(new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y);
    });
    expect(rowYs).toEqual([-100, -100, -100]);
  });

  it('re-sorts the rows against a sibling on the frame the mixer moves the layer', async () => {
    const { renderer } = await mount();
    expect(drawOrder(sceneRoot(renderer))).toEqual(['row 0', 'row 1', 'Bar', 'row 2']);

    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    expect(drawOrder(sceneRoot(renderer))).toEqual(['Bar', 'row 0', 'row 1', 'row 2']);
  });

  it('draws the rows in their authored order again when the clip stops', async () => {
    const { renderer } = await mount();
    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    await stop();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.1));

    expect(drawOrder(sceneRoot(renderer))).toEqual(['row 0', 'row 1', 'Bar', 'row 2']);
  });
});
