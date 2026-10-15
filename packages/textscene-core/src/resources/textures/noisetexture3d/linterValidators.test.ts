/** NoiseTexture3D validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWithNoiseTexture(properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="NoiseTexture3D" id="NoiseTexture3D_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

describe('NoiseTexture3D validators', () => {
  it('errors on a depth of 0, which the setter refuses', () => {
    expectDiagnostic(sceneWithNoiseTexture('depth = 0'), { prop: 'depth', severity: 'error' });
  });

  it('accepts a width past the 2048 hint, which is open above', () => {
    expectNoDiagnostic(sceneWithNoiseTexture('width = 4096'), { prop: 'width' });
  });

  it('errors on a blend skirt under the 0.05 the setter accepts', () => {
    expectDiagnostic(sceneWithNoiseTexture('seamless_blend_skirt = 0.01'), {
      prop: 'seamless_blend_skirt',
      severity: 'error',
    });
  });

  it('errors on a malformed seamless flag', () => {
    expectDiagnostic(sceneWithNoiseTexture('seamless = yes'), { prop: 'seamless', severity: 'error' });
  });

  it('accepts a noise reference (edge case)', () => {
    const scene = sceneWithNoiseTexture('noise = SubResource("FastNoiseLite_1")').replace(
      '[sub_resource type="NoiseTexture3D"',
      '[sub_resource type="FastNoiseLite" id="FastNoiseLite_1"]\n\n[sub_resource type="NoiseTexture3D"'
    );
    expectNoDiagnostic(scene, { prop: 'noise' });
  });
});
