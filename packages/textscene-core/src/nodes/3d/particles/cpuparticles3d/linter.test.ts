/**
 * CPUParticles3D semantic rule: the `mesh` reference must resolve, and its
 * absence is a warning (renders nothing per get_configuration_warnings,
 * cpu_particles_3d.cpp:233-235), not an error — a meshless CPUParticles3D is
 * legal Godot, just invisible. Mirrors GridMap's `mesh_library` rule
 * (nodes/3d/gridmap/linter.ts) and MeshInstance3D's `mesh` rule
 * (nodes/3d/meshinstance3d/linter.ts). Format validation lives in
 * linterParser.ts.
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('CPUParticles3D semantic rules', () => {
  it('passes a CPUParticles3D whose mesh resolves', () => {
    const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="SphereMesh" id="1_mesh"]

[node name="CPUParticles3D" type="CPUParticles3D"]
mesh = SubResource("1_mesh")
`;

    expectClean(content);
  });

  it('errors when the mesh reference does not resolve', () => {
    expectDiagnostic(scene(node('CPUParticles3D', { mesh: 'SubResource("9_missing")' })), {
      ruleName: 'valid-cpuparticles3d-resources',
      severity: 'error',
      nodeType: 'CPUParticles3D',
    });
  });

  it('warns (not errors) when a CPUParticles3D has no mesh', () => {
    const content = scene(node('CPUParticles3D', { amount: 8 }));
    expectNoErrors(content);
    expectDiagnostic(content, { ruleName: 'cpuparticles3d-requires-mesh', severity: 'warning' });
  });

  it('leaves other node types alone', () => {
    const content = scene(node('Node3D', {}));
    expectNoDiagnostic(content, { ruleName: 'cpuparticles3d-requires-mesh' });
    expectNoDiagnostic(content, { ruleName: 'valid-cpuparticles3d-resources' });
  });
});
