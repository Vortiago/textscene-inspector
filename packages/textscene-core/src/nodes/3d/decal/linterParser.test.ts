/**
 * Tests for Decal strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('Decal strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid Decal with transform, size, modulate, albedo_mix, cull_mask', () => {
    const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://albedo.png" id="1_a"]

[node name="X" type="Decal"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
texture_albedo = ExtResource("1_a")
size = Vector3(2, 2, 2)
modulate = Color(1, 1, 1, 1)
albedo_mix = 1.0
cull_mask = 1048575
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
transform = Transform3D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('rejects a malformed size Vector3', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
size = Vector3(1, 2)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('size');
  });

  it('rejects an albedo_mix outside 0..1', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
albedo_mix = 1.5
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('albedo_mix');
  });

  it('rejects a cull_mask outside the 32-bit layer range', () => {
    // 0 is legal (renders nothing); 2^32 is not. class_camera3d.html's 1048575
    // is the DEFAULT — the 20 editor-visible layers — never the bound.
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
cull_mask = 4294967296
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);

    expect(errors[0]!.message).toContain('cull_mask');
  });

  it('rejects an invalid texture_albedo reference format', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
texture_albedo = "not_a_reference"
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('texture_albedo');
  });
});
