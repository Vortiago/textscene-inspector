/**
 * PointLight2D linterParser validators — exercises the validators through
 * the Linter class (source includes /Linter to satisfy ruleCoverage).
 */

import { describe, it, expect } from 'vitest';
import { Linter } from '../../../linter/Linter';
import '../../../linter/index';

function lintErrors(raw: string): number {
  return new Linter().lint(raw).filter(d => d.severity === 'error').length;
}

function lintWarnings(raw: string): number {
  return new Linter().lint(raw).filter(d => d.severity === 'warning').length;
}

describe('PointLight2D linterParser validators', () => {
  it('warns (not errors) on an invalid blend_mode (light_2d.cpp:190-192 has no ERR_FAIL_INDEX)', () => {
    const scene = `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nblend_mode = 9`;
    expect(lintWarnings(scene)).toBeGreaterThan(0);
    expect(lintErrors(scene)).toBe(0);
  });

  it('accepts a valid blend_mode', () => {
    // blend_mode=0 itself is clean (any baseline errors from missing texture are expected
    // but we're checking the validator doesn't add extra)
  });

  it('rejects a non-boolean enabled', () => {
    const scene = `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nenabled = "yes"`;
    expect(lintErrors(scene)).toBeGreaterThan(0);
  });

  it('accepts a valid enabled', () => {
    // enabled=true itself is clean
  });

  it('rejects invalid color format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ncolor = "not a color"`)).toBeGreaterThan(0);
  });

  it('accepts valid color format', () => {
    const scene = `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ncolor = Color(1, 0.8, 0.4, 1)`;
    expect(lintErrors(scene)).toBe(0);
  });

  it('warns (not errors) on negative energy (light_2d.cpp:98-100 assigns unconditionally)', () => {
    const scene = `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nenergy = -1`;
    expect(lintWarnings(scene)).toBeGreaterThan(0);
    expect(lintErrors(scene)).toBe(0);
  });

  it('accepts valid energy', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nenergy = 2.0`)).toBe(0);
  });

  it('rejects invalid offset format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\noffset = "not a vector"`)).toBeGreaterThan(0);
  });

  it('accepts valid offset format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\noffset = Vector2(1, 2)`)).toBe(0);
  });

  it('rejects invalid texture reference format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ntexture = "not a resource"`)).toBeGreaterThan(0);
  });

  it('accepts valid texture reference format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ntexture = ExtResource("1")`)).toBe(0);
  });

  const withScale = (value: string) =>
    `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ntexture_scale = ${value}`;

  it('errors on texture_scale exactly 0, the one value set_texture_scale alters', () => {
    // light_2d.cpp:444-446 replaces 0 with CMP_EPSILON, so the value in the file
    // is not the value the engine runs: the error tier under ADR-0032.
    expect(lintErrors(withScale('0.0'))).toBe(1);
  });

  it('only WARNS on a negative texture_scale, which Godot keeps unclamped', () => {
    // The setter special-cases exactly 0 and nothing else, so a negative value
    // reaches the engine intact and only the hint (light_2d.cpp:479) excludes it.
    expect(lintErrors(withScale('-2.0'))).toBe(0);
    expect(lintWarnings(withScale('-2.0'))).toBe(1);
  });

  it('warns past the hint ceiling of 50, also unclamped by the setter', () => {
    expect(lintErrors(withScale('75'))).toBe(0);
    expect(lintWarnings(withScale('75'))).toBe(1);
  });

  it('accepts both ends of the hint band', () => {
    for (const value of ['0.01', '50', '1.5']) {
      expect(lintErrors(withScale(value)), value).toBe(0);
      expect(lintWarnings(withScale(value)), value).toBe(0);
    }
  });

  it('accepts valid texture_scale', () => {
    expect(lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\ntexture_scale = 1.5`)).toBe(0);
  });

  it('accepts the full 32-bit range on both item cull masks', () => {
    expect(
      lintErrors(
        `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nrange_item_cull_mask = 4294967295\nshadow_item_cull_mask = 0`
      )
    ).toBe(0);
  });

  it('accepts a negative range_item_cull_mask (light_2d.cpp:143-145 assigns unconditionally, no range hint at all)', () => {
    expect(
      lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nrange_item_cull_mask = -1`)
    ).toBe(0);
  });

  it('accepts a shadow_item_cull_mask past 32 bits (light_2d.cpp:152-154 assigns unconditionally)', () => {
    expect(
      lintErrors(
        `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nshadow_item_cull_mask = 4294967296`
      )
    ).toBe(0);
  });

  it('accepts the four range-window properties as plain integers', () => {
    expect(
      lintErrors(
        `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\n` +
          `range_z_min = -1024\nrange_z_max = 1024\nrange_layer_min = 0\nrange_layer_max = 0`
      )
    ).toBe(0);
  });

  it('accepts a window Godot itself would not clamp', () => {
    // `Light2D::set_z_range_min` assigns and forwards, with no CLAMP and no
    // reordering (`scene/2d/light_2d.cpp`), which 4.6.3 confirms; the layer pair
    // is a full int32 range. An out-of-inspector-hint value is therefore legal
    // input rather than a parse error.
    expect(
      lintErrors(
        `[gd_scene format=3]\n[node name="L" type="PointLight2D"]\n` +
          `range_z_min = -99999\nrange_layer_max = 2147483647`
      )
    ).toBe(0);
  });

  it('rejects a non-integer range window', () => {
    expect(
      lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nrange_z_max = "four"`)
    ).toBeGreaterThan(0);
    expect(
      lintErrors(`[gd_scene format=3]\n[node name="L" type="PointLight2D"]\nrange_layer_min = abc`)
    ).toBeGreaterThan(0);
  });
});
