/**
 * CPUParticles3D semantic rule: the `mesh` reference must resolve, and a missing
 * one warns (get_configuration_warnings, cpu_particles_3d.cpp:233-235), since a
 * meshless CPUParticles3D is legal but invisible. Format validation lives in
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
      ruleName: 'dangling-resource-reference',
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
    expectNoDiagnostic(content, { ruleName: 'dangling-resource-reference' });
  });
});

/**
 * `set_param_min` raises the max above it and `set_param_max` lowers the min below it
 * (cpu_particles_3d.cpp:293-296, :310-313). Godot applies the keys in the order the file
 * lists them, so the earlier key of a crossed pair loads as the later one's value.
 * Values measured on 4.6.3.
 */
describe('CPUParticles3D min above max', () => {
  const particles = (props: Record<string, number | string>) => scene(node('CPUParticles3D', props));

  it('warns that a min listed first loads as the max', () => {
    expectDiagnostic(particles({ initial_velocity_min: 5, initial_velocity_max: 2 }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
      severity: 'warning',
      nodeType: 'CPUParticles3D',
      contains: ["'initial_velocity_min' 5", "'initial_velocity_max' 2", "'initial_velocity_min' loads as 2"],
    });
  });

  it('warns that a max listed first loads as the min', () => {
    expectDiagnostic(particles({ initial_velocity_max: 2, initial_velocity_min: 5 }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
      contains: ["'initial_velocity_max' loads as 5"],
    });
  });

  it('checks every min/max pair', () => {
    const pairs = [
      'initial_velocity',
      'angular_velocity',
      'orbit_velocity',
      'linear_accel',
      'radial_accel',
      'tangential_accel',
      'damping',
      'angle',
      'scale_amount',
      'hue_variation',
      'anim_speed',
      'anim_offset',
    ];
    for (const pair of pairs) {
      expectDiagnostic(particles({ [`${pair}_min`]: 0.75, [`${pair}_max`]: 0.25 }), {
        ruleName: 'cpuparticles3d-param-min-above-max',
        contains: [`'${pair}_min' loads as 0.25`],
      });
    }
  });

  it('says nothing when min is at or below max', () => {
    expectNoDiagnostic(particles({ angle_min: -30, angle_max: 30 }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
    });
    expectNoDiagnostic(particles({ angle_min: 30, angle_max: 30 }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
    });
  });

  it('says nothing when float storage makes the pair equal', () => {
    expectNoDiagnostic(particles({ scale_amount_min: '0.30000001', scale_amount_max: '0.3' }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
    });
  });

  it('says nothing when only one key of a pair is authored, since only the default moves', () => {
    expectNoDiagnostic(particles({ scale_amount_min: 5 }), { ruleName: 'cpuparticles3d-param-min-above-max' });
    expectNoDiagnostic(particles({ scale_amount_max: 0.5 }), { ruleName: 'cpuparticles3d-param-min-above-max' });
  });

  it('says nothing for nan, which no comparison crosses', () => {
    expectNoDiagnostic(particles({ angle_min: 'nan', angle_max: 0 }), {
      ruleName: 'cpuparticles3d-param-min-above-max',
    });
  });
});
