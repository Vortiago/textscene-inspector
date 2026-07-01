/**
 * Tests for Decal semantic linter rules (resource resolution + presence).
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Decal semantic rules', () => {
  it('passes a decal whose albedo texture resolves', () => {
    expectClean(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://albedo.png" id="1_a"]

[node name="D" type="Decal"]
texture_albedo = ExtResource("1_a")
`);
  });

  it('errors when a referenced texture does not resolve', () => {
    expectDiagnostic(scene(node('Decal', { texture_albedo: 'ExtResource("9_missing")' }, { name: 'D' })), {
      ruleName: 'valid-decal-resources',
      severity: 'error',
    });
  });

  it('warns when a decal has no texture at all', () => {
    expectDiagnostic(scene(node('Decal', { size: 'Vector3(2, 2, 2)' }, { name: 'D' })), {
      ruleName: 'decal-requires-texture',
      severity: 'warning',
    });
  });

  it('does not warn about missing textures when an emission texture is present', () => {
    expectNoDiagnostic(
      `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://emit.png" id="1_e"]

[node name="D" type="Decal"]
texture_emission = ExtResource("1_e")
`,
      { ruleName: 'decal-requires-texture' }
    );
  });
});
