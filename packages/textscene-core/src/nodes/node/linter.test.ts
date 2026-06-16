/**
 * binary-resource-reference: any node referencing a BINARY Godot resource
 * (.scn scene, .res resource) gets a warning — the previewer only loads text
 * formats (.tscn/.tres), so that content degrades to placeholders. Surfaced
 * by the 3d/platformer demo, whose level lives in grid_map.scn + floor.res
 * and silently vanished.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../linter/Linter';
import './linter';

describe('binary-resource-reference', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('warns when a node instances a binary .scn scene', () => {
    const diagnostics = linter.lint(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://stage/grid_map.scn" id="1"]

[node name="Stage" type="Node3D"]

[node name="GridMap" type="Node3D" parent="." instance=ExtResource("1")]
`);
    const hit = diagnostics.find((d) => d.ruleName === 'binary-resource-reference');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('warning');
    expect(hit!.message).toContain('grid_map.scn');
  });

  it('warns when a property references a binary .res resource', () => {
    const diagnostics = linter.lint(`[gd_scene format=3]

[ext_resource type="ArrayMesh" path="res://stage/meshes/floor.res" id="2"]

[node name="Floor" type="MeshInstance3D"]
mesh = ExtResource("2")
`);
    const hit = diagnostics.find((d) => d.ruleName === 'binary-resource-reference');
    expect(hit).toBeDefined();
    expect(hit!.message).toContain('floor.res');
  });

  it('stays silent for text resources (.tscn/.tres)', () => {
    const diagnostics = linter.lint(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://child.tscn" id="1"]
[ext_resource type="Material" path="res://mat.tres" id="2"]

[node name="A" type="Node3D" instance=ExtResource("1")]
material_override = ExtResource("2")
`);
    expect(diagnostics.filter((d) => d.ruleName === 'binary-resource-reference')).toEqual([]);
  });
});
