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

  // decal.cpp:184-188
  it('warns when a normal texture is set without an albedo texture', () => {
    expectDiagnostic(
      `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://normal.png" id="1_n"]

[node name="D" type="Decal"]
texture_normal = ExtResource("1_n")
`,
      { ruleName: 'decal-normal-orm-without-albedo', severity: 'warning' }
    );
  });

  it('warns when an ORM texture is set without an albedo texture', () => {
    expectDiagnostic(
      `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://orm.png" id="1_o"]

[node name="D" type="Decal"]
texture_orm = ExtResource("1_o")
`,
      { ruleName: 'decal-normal-orm-without-albedo', severity: 'warning' }
    );
  });

  it('does not warn about normal/ORM when albedo is also set', () => {
    expectNoDiagnostic(
      `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://albedo.png" id="1_a"]
[ext_resource type="Texture2D" path="res://normal.png" id="1_n"]

[node name="D" type="Decal"]
texture_albedo = ExtResource("1_a")
texture_normal = ExtResource("1_n")
`,
      { ruleName: 'decal-normal-orm-without-albedo' }
    );
  });

  // decal.cpp:191-192
  it('warns when cull_mask is explicitly zero', () => {
    expectDiagnostic(scene(node('Decal', { size: 'Vector3(2, 2, 2)', cull_mask: 0 }, { name: 'D' })), {
      ruleName: 'decal-empty-cull-mask',
      severity: 'warning',
    });
  });

  it('does not warn about cull_mask when the key is absent (default is all bits)', () => {
    expectNoDiagnostic(scene(node('Decal', { size: 'Vector3(2, 2, 2)' }, { name: 'D' })), {
      ruleName: 'decal-empty-cull-mask',
    });
  });

  it('does not warn about a non-zero cull_mask', () => {
    expectNoDiagnostic(scene(node('Decal', { size: 'Vector3(2, 2, 2)', cull_mask: 4 }, { name: 'D' })), {
      ruleName: 'decal-empty-cull-mask',
    });
  });
});
