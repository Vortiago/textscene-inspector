/**
 * A scene the language-feature tests read: an external scene, a texture, a mesh
 * sub-resource, two nodes and a connection. The line numbers the tests use are the
 * ones this string produces, so a change here fails them loudly rather than quietly.
 */

export const SCENE = `[gd_scene load_steps=3 format=3 uid="uid://abc123"]

[ext_resource type="PackedScene" uid="uid://door" path="res://door.tscn" id="1_door"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 1, 1)

[node name="Root" type="Node3D"]
rotation_edit_mode = 0

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
skeleton = NodePath("../Skeleton3D")

[connection signal="pressed" from="Root/Button" to="." method="_on_pressed"]
`;

/** One-based line numbers in {@link SCENE}, named so a test reads as the scene does. */
export const LINE = {
  extDoor: 3,
  subMesh: 6,
  rootNode: 9,
  rootProperty: 10,
  meshNode: 12,
  meshProperty: 13,
  skeletonProperty: 14,
  connection: 16,
} as const;

/**
 * The opening of a scene of nested nodes: Root, Player, Player/Sprite and Player/Sprite/Gun, on
 * lines 2, 4, 6 and 8 (zero-based). A suite appends its own headings and connections.
 */
export const NODE_TREE_HEAD = [
  '[gd_scene format=3]',
  '',
  '[node name="Root" type="Node3D"]',
  '',
  '[node name="Player" type="Node3D" parent="."]',
  '',
  '[node name="Sprite" type="Sprite3D" parent="Player"]',
  '',
  '[node name="Gun" type="Node3D" parent="Player/Sprite"]',
  '',
];

/**
 * A scene with nodes under an instanced scene: Root, the instance Inst, X under `Inst/Sub` and Y
 * under `Inst/Sub/X`, on lines 2, 4, 6 and 8 (zero-based), and a connection on line 10.
 */
export const INSTANCED_TREE = [
  '[gd_scene format=3]',
  '',
  '[node name="Root" type="Node3D"]',
  '',
  '[node name="Inst" parent="." instance=ExtResource("1_door")]',
  '',
  '[node name="X" type="Node3D" parent="Inst/Sub"]',
  '',
  '[node name="Y" type="Node3D" parent="Inst/Sub/X"]',
  '',
  '[connection signal="a" from="." to="Inst/Sub/X" method="_a"]',
  '',
].join('\n');
