/** CompressedTexture2DArray validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterValidators';

function sceneWithTexture(properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="CompressedTexture2DArray" id="CompressedTexture2DArray_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

describe('CompressedTexture2DArray validators', () => {
  it('accepts a quoted load path', () => {
    expectNoDiagnostic(sceneWithTexture('load_path = "res://.godot/imported/scene.exr-1.ctexarray"'), {
      prop: 'load_path',
    });
  });

  it('errors on an unquoted load path', () => {
    expectDiagnostic(sceneWithTexture('load_path = 3'), { prop: 'load_path', severity: 'error' });
  });

  it('accepts an empty load path (edge case)', () => {
    expectNoDiagnostic(sceneWithTexture('load_path = ""'), { prop: 'load_path' });
  });
});
