/**
 * Tests for Decal semantic linter rules (resource resolution + presence).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Decal semantic rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a decal whose albedo texture resolves', () => {
    const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://albedo.png" id="1_a"]

[node name="D" type="Decal"]
texture_albedo = ExtResource("1_a")
`;

    expect(linter.lint(content)).toHaveLength(0);
  });

  it('errors when a referenced texture does not resolve', () => {
    const content = `[gd_scene format=3]

[node name="D" type="Decal"]
texture_albedo = ExtResource("9_missing")
`;

    const diagnostics = linter.lint(content);
    const error = diagnostics.find((d) => d.ruleName === 'valid-decal-resources');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
  });

  it('warns when a decal has no texture at all', () => {
    const content = `[gd_scene format=3]

[node name="D" type="Decal"]
size = Vector3(2, 2, 2)
`;

    const diagnostics = linter.lint(content);
    const warning = diagnostics.find((d) => d.ruleName === 'decal-requires-texture');
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('warning');
  });

  it('does not warn about missing textures when an emission texture is present', () => {
    const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://emit.png" id="1_e"]

[node name="D" type="Decal"]
texture_emission = ExtResource("1_e")
`;

    const diagnostics = linter.lint(content);
    expect(diagnostics.find((d) => d.ruleName === 'decal-requires-texture')).toBeUndefined();
  });
});
