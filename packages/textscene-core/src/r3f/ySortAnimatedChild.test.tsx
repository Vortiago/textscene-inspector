/**
 * A child that an AnimationPlayer moves across a tile row re-sorts with the rows on the frame the
 * mixer moves it, as Godot's per-frame y-sort does (`renderer_canvas_cull.cpp:110-170`).
 */
import { describe, it, expect, vi } from 'vitest';
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

/** Rows 0 to 2 sort at y 32, 96 and 160. The child slides from y 20 to y 200 in one second. */
const SCENE = `[gd_scene format=3]
[ext_resource type="TileSet" path="res://tiles.tres" id="1"]

[sub_resource type="Animation" id="Slide"]
resource_name = "slide"
length = 1.0
tracks/0/type = "value"
tracks/0/path = NodePath("Child:position")
tracks/0/interp = 1
tracks/0/keys = {
"times": PackedFloat32Array(0, 1),
"transitions": PackedFloat32Array(1, 1),
"update": 0,
"values": [Vector2(96, 20), Vector2(96, 200)]
}

[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"slide": SubResource("Slide")
}

[node name="Layer" type="TileMapLayer"]
tile_set = ExtResource("1")
y_sort_enabled = true
tile_map_data = PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0)

[node name="Child" type="Polygon2D" parent="."]
position = Vector2(96, 20)
polygon = PackedVector2Array(-80, -70, -20, -70, -20, 30, -80, 30)

[node name="Player" type="AnimationPlayer" parent="."]
libraries/ = SubResource("Lib")
`;

/** The TileSet and the atlas texture it names, which a row needs to draw a mesh. */
function seedTileSet(fake: FakeResourceLoader): void {
  fake.resources.seed('res://tiles.tres', parseTresFile(TILE_SET));
  seedAtlasTexture(fake);
}

/** The row and child names in the order three paints them. */
function drawOrder(root: THREE.Object3D): string[] {
  return namesInPaintOrder(root, (o) => o.name.startsWith('TileGroup_') || o.name === 'Child').map((name) =>
    name.replace(/^TileGroup_.*_\d+_(\d+)$/, 'row $1')
  );
}

const NODE_SCENE = `[gd_scene format=3]

[sub_resource type="Animation" id="Slide"]
resource_name = "slide"
length = 1.0
tracks/0/type = "value"
tracks/0/path = NodePath("Mover:position")
tracks/0/interp = 1
tracks/0/keys = {
"times": PackedFloat32Array(0, 1),
"transitions": PackedFloat32Array(1, 1),
"update": 0,
"values": [Vector2(0, 10), Vector2(0, 90)]
}

[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"slide": SubResource("Slide")
}

[node name="World" type="Node2D"]
y_sort_enabled = true

[node name="Mover" type="Polygon2D" parent="."]
position = Vector2(0, 10)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Fixed" type="Polygon2D" parent="."]
position = Vector2(0, 40)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Player" type="AnimationPlayer" parent="."]
libraries/ = SubResource("Lib")
`;

/** `names` in the order three paints them. */
function namesInDrawOrder(root: THREE.Object3D, names: string[]): string[] {
  return namesInPaintOrder(root, (o) => names.includes(o.name));
}

describe('a child that an AnimationPlayer moves across the rows of a y-sorted TileMapLayer', () => {
  it('draws over the rows it has passed on the frame it passes them', async () => {
    const { renderer } = await mountWithPlayer(SCENE, 'Layer/Player', {
      workspace: '2d',
      seed: seedTileSet,
    });
    await settleLoads();
    expect(drawOrder(sceneRoot(renderer))).toEqual(['Child', 'row 0', 'row 1', 'row 2']);

    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    expect(drawOrder(sceneRoot(renderer))).toEqual(['row 0', 'row 1', 'Child', 'row 2']);
  });

  // The y-sort renders its items in collection order: a reordered child makes R3F apply its authored
  // position again, which would put the child back at y 20 after the mixer moved it.
  it('keeps the pose the mixer wrote once the child re-sorts past a row', async () => {
    const { renderer } = await mountWithPlayer(SCENE, 'Layer/Player', {
      workspace: '2d',
      seed: seedTileSet,
    });
    await settleLoads();
    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0));

    expect(Math.abs(sceneRoot(renderer).getObjectByName('Child')!.position.y)).toBeCloseTo(110);
  });

  it('draws under the rows again when the clip stops', async () => {
    const { renderer } = await mountWithPlayer(SCENE, 'Layer/Player', {
      workspace: '2d',
      seed: seedTileSet,
    });
    await settleLoads();
    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    await stop();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.1));

    expect(drawOrder(sceneRoot(renderer))).toEqual(['Child', 'row 0', 'row 1', 'row 2']);
  });
});

describe('a child that an AnimationPlayer moves past a sibling in a y-sorted Node2D', () => {
  it('draws over the sibling once it is below it', async () => {
    const { renderer } = await mountWithPlayer(NODE_SCENE, 'World/Player', { workspace: '2d' });
    await settleLoads();
    expect(namesInDrawOrder(sceneRoot(renderer), ['Mover', 'Fixed'])).toEqual(['Mover', 'Fixed']);

    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 0.5));

    expect(namesInDrawOrder(sceneRoot(renderer), ['Mover', 'Fixed'])).toEqual(['Fixed', 'Mover']);
  });

  it('reads only the groups the clip moves', async () => {
    const { renderer } = await mountWithPlayer(NODE_SCENE, 'World/Player', { workspace: '2d' });
    await settleLoads();
    const fixed = sceneRoot(renderer).getObjectByName('Fixed')!;
    const updateMatrix = vi.spyOn(fixed, 'updateMatrix');

    await play();
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(3, 0.1));

    expect(updateMatrix).not.toHaveBeenCalled();
  });
});
