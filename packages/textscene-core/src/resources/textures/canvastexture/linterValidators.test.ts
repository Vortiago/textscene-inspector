/** CanvasTexture validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWithTexture(properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="CanvasTexture" id="CanvasTexture_1"]
${properties}

[node name="Root" type="Node2D"]
`;
}

describe('CanvasTexture validators', () => {
  it('accepts a shininess inside the hint', () => {
    expectNoDiagnostic(sceneWithTexture('specular_shininess = 0.5'), { prop: 'specular_shininess' });
  });

  it('warns on a shininess past the hint, which the setter keeps', () => {
    expectDiagnostic(sceneWithTexture('specular_shininess = 2.0'), {
      prop: 'specular_shininess',
      severity: 'warning',
    });
  });

  it('errors on a normal map that is no resource reference', () => {
    expectDiagnostic(sceneWithTexture('normal_texture = 3'), { prop: 'normal_texture', severity: 'error' });
  });

  it('warns on a filter past the last mode (edge case)', () => {
    expectDiagnostic(sceneWithTexture('texture_filter = 7'), { prop: 'texture_filter', severity: 'warning' });
  });
});
