/**
 * binary-resource-reference: a node referencing a binary Godot resource (`.scn` scene, `.res`
 * resource) warns, since the previewer loads only text formats (`.tscn`, `.tres`) and that content
 * degrades to placeholders.
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
