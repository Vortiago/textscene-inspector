/**
 * The `unit-*.tscn` a new slice ships with: the smallest scene that puts the
 * type under a root of the right kind, authored the way Godot would write it.
 */

export function fixtureFor(baseKey, typeName) {
  const FIXTURES = {
    // A Control is laid out by anchors and offsets under a Control parent; a
    // Transform3D on one is not a thing Godot would ever write.
    control: `[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="My${typeName}" type="${typeName}" parent="."]
layout_mode = 1
offset_left = 8.0
offset_top = 8.0
offset_right = 108.0
offset_bottom = 40.0
`,
    node2d: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="My${typeName}" type="${typeName}" parent="."]
position = Vector2(10, 20)
`,
    node3d: `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="My${typeName}" type="${typeName}" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
`,
    // A non-spatial node carries no transform at all.
    node: `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="My${typeName}" type="${typeName}" parent="."]
`,
  };
  return FIXTURES[baseKey];
}
