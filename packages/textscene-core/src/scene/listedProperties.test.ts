import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { fileBytes } from '../resources/testing/fileBytes';
import { openScene, type Scene } from './openScene';
import type { SceneValue } from './variant';

const SKELETON_AND_TILE_MAP = `[gd_scene format=3]

[sub_resource type="TileSet" id="ts"]

[node name="Main" type="Node3D"]

[node name="Sk" type="Skeleton3D" parent="."]
bones/0/name = "Hip"
bones/0/parent = -1
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0)
bones/0/position = Vector3(0, 0.25, 0)
bones/1/name = "Leg"
bones/1/parent = 0
bones/1/enabled = false
bones/1/rotation = Quaternion(0, 0.7071068, 0, 0.7071068)
bones/1/scale = Vector3(2, 2, 2)
bones/3/name = "Skipped"

[node name="TM" type="TileMap" parent="."]
tile_set = SubResource("ts")
layer_1/name = "Props"
layer_1/z_index = 3
`;

function openSkeletonAndTileMap(): Scene {
  return openScene({ source: SKELETON_AND_TILE_MAP, provider: { loadResource: async () => null } });
}

/** Each answer as `var_to_str` writes it, or null. */
async function answersOf(scene: Scene, path: string, properties: readonly string[]) {
  const node = scene.getNode(path);
  const texts = async (property: string) => textOf(await node.get(property));
  return Object.fromEntries(await Promise.all(properties.map(async (p) => [p, await texts(p)])));
}

function textOf(value: SceneValue | null): string | null {
  if (value === null) return null;
  return typeof value === 'object' ? value.text : JSON.stringify(value);
}

// Each value is what Godot 4.6.3 answers for the same scene (measured).
describe('get of a Skeleton3D bone', () => {
  it('answers each leaf a bone takes from the file, and the add_bone default of the others', async () => {
    const answers = await answersOf(openSkeletonAndTileMap(), 'Sk', [
      'bones/0/name',
      'bones/0/parent',
      'bones/0/rest',
      'bones/0/enabled',
      'bones/0/position',
      'bones/0/rotation',
      'bones/0/scale',
      'bones/1/enabled',
      'bones/1/rotation',
      'bones/1/scale',
      'bones/1/position',
    ]);

    expect(answers).toEqual({
      'bones/0/name': '"Hip"',
      'bones/0/parent': '-1',
      'bones/0/rest': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0)',
      'bones/0/enabled': 'true',
      'bones/0/position': 'Vector3(0, 0.25, 0)',
      'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
      'bones/0/scale': 'Vector3(1, 1, 1)',
      'bones/1/enabled': 'false',
      'bones/1/rotation': 'Quaternion(0, 0.7071068, 0, 0.7071068)',
      'bones/1/scale': 'Vector3(2, 2, 2)',
      'bones/1/position': 'Vector3(0, 0, 0)',
    });
  });

  it('answers null past the last bone, and for a leaf _get has no arm for', async () => {
    const answers = await answersOf(openSkeletonAndTileMap(), 'Sk', [
      'bones/1/name',
      'bones/2/name',
      'bones/3/name',
      'bones/0/bogus',
    ]);

    expect(answers).toEqual({
      'bones/1/name': '"Leg"',
      'bones/2/name': null,
      'bones/3/name': null,
      'bones/0/bogus': null,
    });
  });

  it('reads an index that is no number as bone 0, as to_int does', async () => {
    expect(await answersOf(openSkeletonAndTileMap(), 'Sk', ['bones/x/name'])).toEqual({
      'bones/x/name': '"Hip"',
    });
  });
});

describe('get of a TileMap layer', () => {
  it('answers the default of each leaf of a layer the file sets nothing of', async () => {
    const answers = await answersOf(openSkeletonAndTileMap(), 'TM', [
      'layer_0/name',
      'layer_0/enabled',
      'layer_0/modulate',
      'layer_0/y_sort_enabled',
      'layer_0/y_sort_origin',
      'layer_0/z_index',
      'layer_0/navigation_enabled',
    ]);

    expect(answers).toEqual({
      'layer_0/name': '"Layer0"',
      'layer_0/enabled': 'true',
      'layer_0/modulate': 'Color(1, 1, 1, 1)',
      'layer_0/y_sort_enabled': 'false',
      'layer_0/y_sort_origin': '0',
      'layer_0/z_index': '0',
      'layer_0/navigation_enabled': 'true',
    });
  });

  it('answers the leaves the file sets, and null past the last layer', async () => {
    const answers = await answersOf(openSkeletonAndTileMap(), 'TM', [
      'layer_1/name',
      'layer_1/z_index',
      'layer_2/name',
      'layer_0/bogus',
    ]);

    expect(answers).toEqual({
      'layer_1/name': '"Props"',
      'layer_1/z_index': '3',
      'layer_2/name': null,
      'layer_0/bogus': null,
    });
  });
});

describe('get of a TileMap layer tile_data', () => {
  /** A duplicate cell keeps its first place with its last value, as the layer's HashMap does. */
  const TILES = `[gd_scene format=3]

[node name="A" type="TileMap"]
layer_0/tile_data = PackedInt32Array(0, 1, 0, 65536, 2, 3, 0, 5, 0, 1, 65535, 0)
layer_2/tile_data = PackedInt32Array(0, 1, 0)

[node name="Old" type="TileMap" parent="."]
format = 1
layer_0/tile_data = PackedInt32Array(0, 1, 0)
`;

  it('answers the cells of each layer in the format Godot saves, and no cells for a layer with none', async () => {
    const scene = openScene({ source: TILES, provider: { loadResource: async () => null } });
    const names = [0, 1, 2, 3].map((index) => `layer_${index}/tile_data`);

    expect(await answersOf(scene, '.', names)).toEqual({
      'layer_0/tile_data': 'PackedInt32Array(0, 5, 0, 65536, 2, 3, 1, 65535, 0)',
      'layer_1/tile_data': 'PackedInt32Array()',
      'layer_2/tile_data': 'PackedInt32Array(0, 1, 0)',
      'layer_3/tile_data': null,
    });
  });

  it('answers no cells for a Godot 3 format, which a build without the deprecated code drops', async () => {
    const scene = openScene({ source: TILES, provider: { loadResource: async () => null } });

    expect(await answersOf(scene, 'Old', ['layer_0/tile_data'])).toEqual({
      'layer_0/tile_data': 'PackedInt32Array()',
    });
  });
});

describe('get of a TileMap layer name', () => {
  /** Godot 4.6.3 names a gap layer after the index the loop builds to, and suffixes a taken name. */
  const RENAMES = `[gd_scene format=3]

[node name="TM" type="TileMap"]
layer_1/name = "Layer0"
layer_3/enabled = false
layer_2/name = "Ground"
layer_0/name = "Ground"
layer_4/name = "a.b"
`;

  it('answers the node name each layer ends with after the file renames them in order', async () => {
    const scene = openScene({ source: RENAMES, provider: { loadResource: async () => null } });
    const names = ['layer_0/name', 'layer_1/name', 'layer_2/name', 'layer_3/name', 'layer_4/name'];

    expect(await answersOf(scene, '.', names)).toEqual({
      'layer_0/name': '"Ground2"',
      'layer_1/name': '"Layer1"',
      'layer_2/name': '"Ground"',
      'layer_3/name': '"Layer4"',
      'layer_4/name': '"a_b"',
    });
  });
  it('names each layer the loop builds past index 64 as it names the layers below it', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[node name="TM" type="TileMap"]
layer_3/name = "Layer70"
layer_64/z_index = 1
layer_65/enabled = false
`,
      provider: { loadResource: async () => null },
    });
    const names = [9, 10, 63, 64, 65, 66].map((index) => `layer_${index}/name`);

    expect(await answersOf(scene, '.', names)).toEqual({
      'layer_9/name': '"Layer69"',
      'layer_10/name': '"Layer71"',
      'layer_63/name': '"Layer124"',
      'layer_64/name': '"Layer125"',
      'layer_65/name': '"Layer126"',
      'layer_66/name': null,
    });
  });

  it('names a layer below a written layer far past the ceiling as the loop builds it', async () => {
    const scene = openScene({
      source: `[gd_scene format=3]

[node name="TM" type="TileMap"]
layer_70000/name = "A"
layer_1/enabled = false
`,
      provider: { loadResource: async () => null },
    });

    expect(await answersOf(scene, '.', ['layer_1/name'])).toEqual({ 'layer_1/name': '"Layer1"' });
  });
});

describe('get of a MeshInstance3D surface material override', () => {
  /** A BoxMesh has one surface, the ArrayMesh two, and None has no mesh. */
  const OVERRIDES = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="box"]

[sub_resource type="StandardMaterial3D" id="mat"]

[sub_resource type="StandardMaterial3D" id="mat2"]

[sub_resource type="ArrayMesh" id="two"]
_surfaces = [{
"aabb": AABB(0, 0, 0, 1, 1, 0),
"format": 34359742465,
"index_count": 3,
"index_data": PackedByteArray(0, 0, 1, 0, 2, 0),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 3,
"vertex_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 128, 63, 0, 0, 0, 0)
}, {
"aabb": AABB(0, 0, 0, 1, 1, 0),
"format": 34359742465,
"index_count": 3,
"index_data": PackedByteArray(0, 0, 1, 0, 2, 0),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 3,
"vertex_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 128, 63, 0, 0, 0, 0)
}]

[node name="Main" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("box")
surface_material_override/0 = SubResource("mat")

[node name="Unset" type="MeshInstance3D" parent="."]
mesh = SubResource("box")

[node name="Two" type="MeshInstance3D" parent="."]
mesh = SubResource("two")
surface_material_override/1 = SubResource("mat2")

[node name="None" type="MeshInstance3D" parent="."]
surface_material_override/0 = SubResource("mat")
`;

  /** Each override 0 to 2 as `var_to_str` writes it, `null` text when unset, null where _get refuses. */
  async function overridesOf(path: string) {
    const scene = openScene({
      source: OVERRIDES,
      rootScenePath: 'res://ovr.tscn',
      provider: { loadResource: async () => null },
    });
    const node = scene.getNode(path);
    return Promise.all(
      [0, 1, 2].map(async (index) => textOf(await node.get(`surface_material_override/${index}`)))
    );
  }

  it('answers the override of each surface of the mesh, and null past the last', async () => {
    expect(await overridesOf('Box')).toEqual(['Resource("res://ovr.tscn::mat")', null, null]);
  });

  it('answers a null object for a surface the file sets no override of', async () => {
    expect(await overridesOf('Unset')).toEqual(['null', null, null]);
  });

  it('counts the surfaces an ArrayMesh holds', async () => {
    expect(await overridesOf('Two')).toEqual(['null', 'Resource("res://ovr.tscn::mat2")', null]);
  });

  it('answers null for every index of a node with no mesh, which has no surface to override', async () => {
    expect(await overridesOf('None')).toEqual([null, null, null]);
  });

  it('counts the surfaces of a mesh another file holds, text or binary', async () => {
    const fixtures = join(import.meta.dirname, '../../../../scenes/fixtures');
    const files: Readonly<Record<string, string | ArrayBuffer>> = {
      'res://quads.tres': readFileSync(join(fixtures, 'unit-arraymesh-surface-override-quads.tres'), 'utf8'),
      'res://binary.res': fileBytes(join(fixtures, 'unit-binary-resource-mesh.res')),
    };
    const scene = openScene({
      source: `[gd_scene format=3]

[ext_resource type="ArrayMesh" path="res://quads.tres" id="q"]
[ext_resource type="ArrayMesh" path="res://binary.res" id="b"]

[node name="Main" type="Node3D"]

[node name="Quads" type="MeshInstance3D" parent="."]
mesh = ExtResource("q")

[node name="Binary" type="MeshInstance3D" parent="."]
mesh = ExtResource("b")
`,
      provider: { loadResource: async (path) => files[path] ?? null },
    });
    const overrides = (path: string) =>
      Promise.all(
        [0, 1, 2].map(async (i) => textOf(await scene.getNode(path).get(`surface_material_override/${i}`)))
      );

    expect([await overrides('Quads'), await overrides('Binary')]).toEqual([
      ['null', 'null', null],
      ['null', 'null', null],
    ]);
  });
});
