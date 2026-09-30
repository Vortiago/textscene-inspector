/**
 * binary-resource-reference reports, at info, a node that references a binary Godot resource
 * (`.scn` scene, `.res` resource). The previewer loads only text formats (`.tscn`, `.tres`), so
 * that content shows as missing.
 */
import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../linter/testing/testkit';
import './linter';

describe('binary-resource-reference', () => {
  it('reports when a node instances a binary .scn scene', () => {
    expectDiagnostic(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://stage/grid_map.scn" id="1"]

[node name="Stage" type="Node3D"]

[node name="GridMap" type="Node3D" parent="." instance=ExtResource("1")]
`,
      { ruleName: 'binary-resource-reference', severity: 'info', contains: ['grid_map.scn'] }
    );
  });

  it('reports when a property references a binary .res resource', () => {
    expectDiagnostic(
      `[gd_scene format=3]

[ext_resource type="ArrayMesh" path="res://stage/meshes/floor.res" id="2"]

[node name="Floor" type="MeshInstance3D"]
mesh = ExtResource("2")
`,
      { ruleName: 'binary-resource-reference', contains: ['floor.res'] }
    );
  });

  it('names a typeless heading <unknown>, as every other diagnostic does', () => {
    // A heading inside instanced content states no type, and an empty string
    // reads in the CLI as a type that has no name.
    expectDiagnostic(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://child.tscn" id="1"]
[ext_resource type="Texture2D" path="res://icon.res" id="2"]

[node name="Root" type="Node2D"]

[node name="Child" parent="." instance=ExtResource("1")]

[node name="Inner" parent="Child"]
texture = ExtResource("2")
`,
      { ruleName: 'binary-resource-reference', nodeType: '<unknown>' }
    );
  });

  it('stays silent for text resources (.tscn/.tres)', () => {
    expectNoDiagnostic(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://child.tscn" id="1"]
[ext_resource type="Material" path="res://mat.tres" id="2"]

[node name="A" type="Node3D" instance=ExtResource("1")]
material_override = ExtResource("2")
`,
      { ruleName: 'binary-resource-reference' }
    );
  });
});
