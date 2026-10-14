/** ImageTexture3D validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWithTexture(properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="ImageTexture3D" id="ImageTexture3D_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

describe('ImageTexture3D validators', () => {
  it('accepts the typed image array Godot writes', () => {
    expectNoDiagnostic(sceneWithTexture('_images = Array[Image]([])'), { prop: '_images' });
  });

  it('errors on an array typed otherwise, which the TypedArray setter refuses', () => {
    expectDiagnostic(sceneWithTexture('_images = Array[int]([1])'), { prop: '_images', severity: 'error' });
  });

  it('errors on a value that is no array (edge case)', () => {
    expectDiagnostic(sceneWithTexture('_images = 3'), { prop: '_images', severity: 'error' });
  });
});
