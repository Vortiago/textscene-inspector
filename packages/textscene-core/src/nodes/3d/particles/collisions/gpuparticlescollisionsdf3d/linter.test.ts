/**
 * Tests for the GPUParticlesCollisionSDF3D bake-mask rule
 * (`gpuparticlescollisionsdf3d-empty-bake-mask`), ported from
 * `GPUParticlesCollisionSDF3D::get_configuration_warnings()`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'gpuparticlescollisionsdf3d-empty-bake-mask';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

describe('GPUParticlesCollisionSDF3D bake-mask rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('stays quiet when bake_mask is absent (Godot default: all layers)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Collider" type="GPUParticlesCollisionSDF3D" parent="."]
size = Vector3(2, 2, 2)
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when bake_mask has at least one bit set', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Collider" type="GPUParticlesCollisionSDF3D" parent="."]
bake_mask = 3
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('warns when bake_mask is explicitly 0', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Collider" type="GPUParticlesCollisionSDF3D" parent="."]
bake_mask = 0
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('Bake Mask');
  });

  it('does not warn about nodes that are not GPUParticlesCollisionSDF3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Collider" type="GPUParticlesCollisionBox3D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
