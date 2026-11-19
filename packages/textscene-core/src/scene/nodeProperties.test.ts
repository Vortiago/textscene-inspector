import { afterEach, describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { variant, type SceneValue } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';
import * as logger from '../logger';

const provider: ResourceProvider = { loadResource: async () => null };

const NODES = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Area" type="Area3D" parent="."]

[node name="Hud" type="Control" parent="."]

[node name="Score" type="Label" parent="Hud"]
text = "Score"

[node name="Copy" type="BackBufferCopy" parent="."]

[node name="Bone" type="Bone2D" parent="."]

[node name="Shape" type="CollisionPolygon2D" parent="."]

[node name="Sparks" type="CPUParticles3D" parent="."]

[node name="Dust" type="CPUParticles2D" parent="."]

[node name="List" type="ItemList" parent="Hud"]

[node name="Code" type="CodeEdit" parent="Hud"]

[node name="Split" type="HSplitContainer" parent="Hud"]

[node name="Open" type="FileDialog" parent="."]

[node name="Player" type="AnimationPlayer" parent="."]

[node name="Sprite" type="AnimatedSprite2D" parent="."]

[node name="Tiles" type="TileMapLayer" parent="."]

[node name="Spring" type="SpringBoneCollisionSphere3D" parent="."]

[node name="Popup" type="Window" parent="."]

[node name="Cast" type="ShapeCast3D" parent="."]

[node name="Music" type="AudioStreamPlayer" parent="."]
volume_db = -6.0
`;

const sceneOfNodes = () => openScene({ source: NODES, provider, rootScenePath: 'res://main.tscn' });

/** One property of each Variant type the class table lists, with a value of it. */
const EACH_TYPE: readonly (readonly [type: string, node: string, property: string, value: SceneValue])[] = [
  ['bool', 'Hud/Score', 'clip_text', true],
  ['int', 'Hud/Score', 'max_lines_visible', 3],
  ['float', 'Hud/Score', 'visible_ratio', 0.5],
  ['String', 'Hud/Score', 'text', 'Game over'],
  ['StringName', 'Hud/Score', 'theme_type_variation', variant('&"Title"')],
  ['NodePath', 'Player', 'root_motion_track', variant('NodePath("Hips:position")')],
  ['Vector2', 'Sprite', 'offset', variant('Vector2(2, -3)')],
  ['Vector2i', 'Hud/List', 'fixed_icon_size', variant('Vector2i(16, 32)')],
  ['Vector3', 'Area', 'gravity_direction', variant('Vector3(0, 1, 0)')],
  ['Rect2', 'Copy', 'rect', variant('Rect2(1, 2, 30, 40)')],
  ['Rect2i', 'Popup', 'nonclient_area', variant('Rect2i(0, 0, 8, 8)')],
  ['Transform2D', 'Bone', 'rest', variant('Transform2D(1, 0, 0, 1, 5, 6)')],
  ['Transform3D', 'Area', 'transform', variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 0, 2)')],
  ['Quaternion', 'Spring', 'rotation_offset', variant('Quaternion(0, 0, 0.6, 0.8)')],
  ['AABB', 'Sparks', 'visibility_aabb', variant('AABB(-1, -1, -1, 2, 2, 2)')],
  ['Color', 'Hud/Score', 'modulate', variant('Color(1, 0, 0, 0.5)')],
  ['Dictionary', 'Hud/Code', 'auto_brace_completion_pairs', variant('{\n"(": ")"\n}')],
  ['Array', 'Hud', 'accessibility_controls_nodes', variant('Array[NodePath]([NodePath("Score")])')],
  [
    'PackedByteArray',
    'Tiles',
    'tile_map_data',
    variant('PackedByteArray(0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 4, 0, 0, 0)'),
  ],
  ['PackedInt32Array', 'Hud/Split', 'split_offsets', variant('PackedInt32Array(80, 100)')],
  ['PackedFloat32Array', 'Hud/Score', 'tab_stops', variant('PackedFloat32Array(8, 16)')],
  ['PackedStringArray', 'Open', 'filters', variant('PackedStringArray("*.png")')],
  ['PackedVector2Array', 'Shape', 'polygon', variant('PackedVector2Array(0, 0, 10, 0, 0, 10)')],
  ['PackedVector3Array', 'Sparks', 'emission_normals', variant('PackedVector3Array(0, 1, 0)')],
  ['PackedColorArray', 'Dust', 'emission_colors', variant('PackedColorArray(1, 1, 1, 1)')],
];

describe('set then get', () => {
  it.each(EACH_TYPE)('answers the written %s', async (_type, path, property, value) => {
    const node = sceneOfNodes().getNode(path);
    expect(await node.set(property, value)).toBe(true);
    expect(await node.get(property)).toEqual(value);
  });
});

describe('get of a property nobody wrote', () => {
  it('answers the value of the file', async () => {
    expect(await sceneOfNodes().getNode('Hud/Score').get('text')).toBe('Score');
  });

  it('answers the class default', async () => {
    expect(await sceneOfNodes().getNode('Hud/Score').get('mouse_filter')).toBe(2);
  });

  it('answers the default of a base class', async () => {
    expect(await sceneOfNodes().getNode('Area').get('rotation_order')).toBe(2);
  });
});

describe('a setter that writes more than its own property', () => {
  it('moves the opposite anchor along with an anchor moved past it', async () => {
    const hud = sceneOfNodes().getNode('Hud');
    await hud.set('anchor_left', 0.75);
    expect(await hud.get('anchor_right')).toBe(0.75);
  });

  it('leaves the opposite anchor where an anchor stays short of it', async () => {
    const hud = sceneOfNodes().getNode('Hud');
    await hud.set('anchor_right', 0.75);
    expect(await hud.get('anchor_left')).toBe(0);
  });
});

describe('a setter that refuses the value', () => {
  it('keeps the volume where a linear volume has no level in decibels, as Godot refuses NaN', async () => {
    const music = sceneOfNodes().getNode('Music');
    await music.set('volume_linear', -1);
    expect(await music.get('volume_db')).toBe(-6);
  });
});

describe('a resource from scene.load', () => {
  it.each([
    ['a shader', 'res://glow.gdshader'],
    ['a shader include', 'res://lib.gdshaderinc'],
    ['a JSON file', 'res://levels.json'],
  ])('refuses %s where the property takes another class', async (_kind, path) => {
    const scene = sceneOfNodes();
    expect(await scene.getNode('Hud').set('material', await scene.load(path))).toBe(false);
  });
});

/** A mesh and a sprite, with a sphere, a material and a texture the file holds for a host to name. */
const HELD = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1_icon"]

[sub_resource type="SphereMesh" id="SphereMesh_1"]

[sub_resource type="StandardMaterial3D" id="Material_2"]

[sub_resource type="BoxMesh" id="BoxMesh_3"]

[node name="Main" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_3")
material_override = SubResource("Material_2")

[node name="Sprite" type="Sprite3D" parent="."]
texture = ExtResource("1_icon")
`;

const ICON_SIDECAR = `[remap]

type="CompressedTexture2D"
`;

const iconProvider: ResourceProvider = {
  loadResource: async (path) => (path === 'res://icon.png.import' ? ICON_SIDECAR : null),
};

const sceneOfHeld = () =>
  openScene({ source: HELD, provider: iconProvider, rootScenePath: 'res://main.tscn' });

/** The text of `property` on the node at `path` in the graph a view draws. */
function drawnText(scene: ReturnType<typeof sceneOfHeld>, path: string, property: string): unknown {
  return scene.written()?.flattenedNodes.find((node) => node.path === path)?.data.rawProperties[property];
}

describe('a resource the scene file holds, named by its path as Godot loads it', () => {
  const sphere = 'Resource("res://main.tscn::SphereMesh_1")';
  const material = 'Resource("res://main.tscn::Material_2")';

  it('draws the sub-resource a write names', async () => {
    const scene = sceneOfHeld();
    expect(await scene.getNode('Mesh').set('mesh', variant(sphere))).toBe(true);
    expect(drawnText(scene, 'Main/Mesh', 'mesh')).toBe('SubResource("SphereMesh_1")');
  });

  it('answers get with the sub-resource written', async () => {
    const mesh = sceneOfHeld().getNode('Mesh');
    await mesh.set('mesh', variant(sphere));
    expect(await mesh.get('mesh')).toEqual(variant(sphere));
  });

  it('draws the sub-resource scene.load gives for its path', async () => {
    const scene = sceneOfHeld();
    await scene.getNode('Sprite').set('material_override', await scene.load('res://main.tscn::Material_2'));
    expect(drawnText(scene, 'Main/Sprite', 'material_override')).toBe('SubResource("Material_2")');
  });

  it('writes null for a sub-resource of another class, as a Ref<Mesh> cast gives', async () => {
    const scene = sceneOfHeld();
    expect(await scene.getNode('Mesh').set('mesh', variant(material))).toBe(false);
    expect(drawnText(scene, 'Main/Mesh', 'mesh')).toBe('null');
  });

  it('writes null for a file of another class, as the class load reads', async () => {
    const scene = sceneOfHeld();
    expect(await scene.getNode('Mesh').set('mesh', variant('Resource("res://icon.png")'))).toBe(false);
    expect(drawnText(scene, 'Main/Mesh', 'mesh')).toBe('null');
  });
});

describe('the refusals', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers false for a name the class does not have', async () => {
    expect(await sceneOfNodes().getNode('Area').set('colour', 1)).toBe(false);
  });

  it('answers null when get asks for a name the class does not have', async () => {
    expect(await sceneOfNodes().getNode('Area').get('colour')).toBeNull();
  });

  it('warns once for a name the class does not have', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const area = sceneOfNodes().getNode('Area');
    await area.set('colour', 1);
    await area.set('colour', 2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('drops the write of a setterless property', async () => {
    expect(await sceneOfNodes().getNode('Cast').set('collision_result', variant('[]'))).toBe(false);
  });

  it('answers false for a value that does not convert strictly, as Godot reports it', async () => {
    expect(await sceneOfNodes().getNode('Hud').set('custom_minimum_size', 'x')).toBe(false);
  });

  it('writes the value Godot converts to even where it reports the write invalid', async () => {
    const hud = sceneOfNodes().getNode('Hud');
    await hud.set('custom_minimum_size', 'x');
    expect(await hud.get('custom_minimum_size')).toEqual(variant('Vector2(0, 0)'));
  });

  it.each(['script', 'instance', 'name'])('throws for a write of %s', async (property) => {
    await expect(sceneOfNodes().getNode('Area').set(property, 'x')).rejects.toThrow(/not in this release/);
  });

  it('throws for a text Godot cannot read', () => {
    expect(() => variant('Vector3(1, 2')).toThrow(/expected a Variant as a .tscn file spells it/);
  });
});
