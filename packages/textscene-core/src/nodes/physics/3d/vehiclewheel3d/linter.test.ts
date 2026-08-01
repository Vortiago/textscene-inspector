/**
 * Tests for the VehicleWheel3D parent rule (`valid-vehiclewheel3d-parent`).
 *
 * Mirrors `VehicleWheel3D::get_configuration_warnings` (scene/3d/physics/vehicle_body_3d.cpp):
 * the only warning it adds checks the parent is a VehicleBody3D.
 */

import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('VehicleWheel3D parent rule', () => {
  it('accepts a wheel under a VehicleBody3D', () => {
    expectClean(
      scene(
        node('VehicleBody3D', {}, { name: 'Body' }),
        node('VehicleWheel3D', {}, { name: 'Wheel', parent: '.' })
      )
    );
  });

  it('warns when the wheel is used as the scene root', () => {
    const warning = expectDiagnostic(scene(node('VehicleWheel3D', {}, { name: 'Wheel' })), {
      ruleName: 'vehiclewheel3d-no-parent',
      severity: 'warning',
      nodeType: 'VehicleWheel3D',
      contains: ['no parent', 'child of a VehicleBody3D'],
    });
    expect(warning.nodeName).toBe('Wheel');
  });

  it('warns for a wheel under any other typed parent', () => {
    const warning = expectDiagnostic(
      scene(
        node('Node3D', {}, { name: 'Root' }),
        node('VehicleWheel3D', {}, { name: 'Wheel', parent: '.' })
      ),
      {
        ruleName: 'vehiclewheel3d-invalid-parent',
        severity: 'warning',
        contains: ['Node3D', 'child of a VehicleBody3D'],
      }
    );
    expect(warning.nodeName).toBe('Wheel');
  });

  it('warns for a wheel directly under a MeshInstance3D', () => {
    expectDiagnostic(
      scene(
        '[sub_resource type="BoxMesh" id="mesh_1"]',
        node('MeshInstance3D', { mesh: 'SubResource("mesh_1")' }, { name: 'Mesh' }),
        node('VehicleWheel3D', {}, { name: 'Wheel', parent: '.' })
      ),
      { ruleName: 'vehiclewheel3d-invalid-parent', contains: ['MeshInstance3D'] }
    );
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    // A wheel added as an editable child of an instanced vehicle scene writes
    // exactly this shape: the parent carries `instance=` with no `type=`, so
    // its real class lives in another file this linter never opens.
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://car_base.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1")]

[node name="ExtraWheel" type="VehicleWheel3D" parent="Body"]
`;
    expect(lint(content).filter((d) => d.ruleName.startsWith('vehiclewheel3d-'))).toEqual([]);
  });

  it('does not warn about nodes that are not VehicleWheel3D', () => {
    expectNoDiagnostic(scene(node('MeshInstance3D', {}, { name: 'Mesh' })), {
      ruleName: 'vehiclewheel3d-invalid-parent',
    });
    expectNoDiagnostic(scene(node('MeshInstance3D', {}, { name: 'Mesh' })), {
      ruleName: 'vehiclewheel3d-no-parent',
    });
  });
});
