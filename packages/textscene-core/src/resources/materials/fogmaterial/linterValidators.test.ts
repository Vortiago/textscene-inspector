/** FogMaterial validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWithFogMaterial(properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="FogMaterial" id="FogMaterial_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

describe('FogMaterial validators', () => {
  it('accepts a negative density, which removes fog', () => {
    expectNoDiagnostic(sceneWithFogMaterial('density = -20.0'), { prop: 'density' });
  });

  it('errors on a negative height falloff, which the setter raises to 0', () => {
    expectDiagnostic(sceneWithFogMaterial('height_falloff = -1.0'), {
      prop: 'height_falloff',
      severity: 'error',
    });
  });

  it('errors on a negative edge fade, which the setter raises to 0', () => {
    expectDiagnostic(sceneWithFogMaterial('edge_fade = -0.5'), { prop: 'edge_fade', severity: 'error' });
  });

  it('errors on a malformed albedo', () => {
    expectDiagnostic(sceneWithFogMaterial('albedo = Color(1, 1)'), { prop: 'albedo', severity: 'error' });
  });

  it('accepts a density texture reference (edge case)', () => {
    const scene = sceneWithFogMaterial('density_texture = SubResource("NoiseTexture3D_1")').replace(
      '[sub_resource type="FogMaterial"',
      '[sub_resource type="NoiseTexture3D" id="NoiseTexture3D_1"]\n\n[sub_resource type="FogMaterial"'
    );
    expectNoDiagnostic(scene, { prop: 'density_texture' });
  });
});
