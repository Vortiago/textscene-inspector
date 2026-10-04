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
