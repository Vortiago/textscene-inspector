/**
 * Tests for Decal strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'warning');
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

  it('warns (not errors) on an albedo_mix outside 0..1', () => {
    // decal.cpp:248 hints "0,1,0.01" but set_albedo_mix (:79-83) is a bare
    // assignment, so out-of-range is a warning, not an error (ADR-0032).
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
albedo_mix = 1.5
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
    const warnings = warningsOf(linter.lint(content));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('albedo_mix');
  });

  it('accepts an upper_fade/lower_fade above 1 — they are curve exponents, not ratios', () => {
    // class_decal.html: "Sets the curve over which the decal will fade as the
    // surface gets further from the center of the AABB. Only positive values are
    // valid (negative values will be clamped to 0.0)." No upper bound is
    // documented, and shipped Godot demo scenes author 2.0.
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
upper_fade = 2.0
lower_fade = 8.0
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a negative upper_fade', () => {
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
upper_fade = -0.5
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('upper_fade');
  });

  it('warns on a cull_mask outside the 32-bit layer range', () => {
    // decal.cpp:263 hints PROPERTY_HINT_LAYERS_3D_RENDER, a 32-checkbox widget,
    // so the width is the UI's and the setter never rejects: a warning, not an
    // error. 1048575 is Camera3D's DEFAULT, never a bound.
    const content = `[gd_scene format=3]

[node name="X" type="Decal"]
cull_mask = 4294967296
`;

    const found = linter.lint(content).filter((x) => x.message.includes('cull_mask'));
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('warning');
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
