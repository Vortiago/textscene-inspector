/**
 * Tests the PointLight2D validators through the Linter class (ruleCoverage reads
 * /Linter in the source). Light2D's own properties live in
 * `nodes/2d/lights/shared/linterParser.ts`, and the last block proves the
 * base-walk, not a shadow copy, delivers them.
 */

import { describe, it, expect } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import '../../../linter/index';

/** How many diagnostics of one severity a scene draws, from every rule. */
const lintCount = (severity: 'error' | 'warning') => (raw: string): number =>
  new Linter().lint(raw).filter(d => d.severity === severity).length;

const lintErrors = lintCount('error');
const lintWarnings = lintCount('warning');

/**
 * Phase-1 warnings naming `prop`. A textureless scene always carries the
 * `pointlight2d-requires-texture` advisory, so a bare warning count says
 * nothing about whether the validator under test fired.
 */
function propWarnings(raw: string, prop: string): number {
  return new Linter()
    .lint(raw)
    .filter(
      d => d.severity === 'warning' && d.ruleName === 'strict-parser' && d.message.includes(prop)
    ).length;
}

describe('PointLight2D linterParser validators', () => {
  it('warns (not errors) on an invalid blend_mode (light_2d.cpp:190-192 has no ERR_FAIL_INDEX)', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nblend_mode = 9`;
    expect(propWarnings(scene, 'blend_mode')).toBe(1);
    expect(lintErrors(scene)).toBe(0);
  });

  it('rejects a non-boolean enabled', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nenabled = "yes"`;
    expect(lintErrors(scene)).toBeGreaterThan(0);
  });

  it('accepts a valid enabled', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture = ExtResource("1")\nenabled = true`;
    expect(lintErrors(scene)).toBe(0);
    expect(lintWarnings(scene)).toBe(0);
  });

  it('rejects invalid color format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ncolor = "not a color"`)).toBeGreaterThan(0);
  });

  it('accepts valid color format', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ncolor = Color(1, 0.8, 0.4, 1)`;
    expect(lintErrors(scene)).toBe(0);
  });

  it('warns (not errors) on negative energy (light_2d.cpp:98-100 assigns unconditionally)', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nenergy = -1`;
    expect(propWarnings(scene, 'energy')).toBe(1);
    expect(lintErrors(scene)).toBe(0);
  });

  it('accepts valid energy', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nenergy = 2.0`)).toBe(0);
  });

  it('rejects invalid offset format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\noffset = "not a vector"`)).toBeGreaterThan(0);
  });

  it('accepts valid offset format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\noffset = Vector2(1, 2)`)).toBe(0);
  });

  it('rejects invalid texture reference format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture = "not a resource"`)).toBeGreaterThan(0);
  });

  it('accepts valid texture reference format', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture = ExtResource("1")`)).toBe(0);
  });

  it('warns (not errors) on a negative height (light_2d.cpp:89-92 assigns unconditionally)', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nheight = -1`;
    expect(propWarnings(scene, 'height')).toBe(1);
    expect(lintErrors(scene)).toBe(0);
  });

  it('accepts valid height', () => {
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nheight = 100`)).toBe(0);
  });

  it('accepts a height past the hint ceiling, which is open (or_greater)', () => {
    const scene = `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture = ExtResource("1")\nheight = 99999`;
    expect(lintErrors(scene)).toBe(0);
    expect(lintWarnings(scene)).toBe(0);
  });

  it('rejects a non-numeric height', () => {
    expect(
      lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nheight = "tall"`)
    ).toBeGreaterThan(0);
  });

  const withScale = (value: string) =>
    `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture = ExtResource("1")\ntexture_scale = ${value}`;

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
    expect(lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\ntexture_scale = 1.5`)).toBe(0);
  });

  it('accepts the full 32-bit range on both item cull masks', () => {
    expect(
      lintErrors(
        `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nrange_item_cull_mask = 4294967295\nshadow_item_cull_mask = 0`
      )
    ).toBe(0);
  });

  it('accepts a negative range_item_cull_mask (light_2d.cpp:143-145 assigns unconditionally, no range hint at all)', () => {
    expect(
      lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nrange_item_cull_mask = -1`)
    ).toBe(0);
  });

  it('refuses a shadow_item_cull_mask past 32 bits, where a bit is dropped', () => {
    // light_2d.cpp:152-154 assigns unconditionally, so the setter refuses
    // nothing, but the int slot cannot carry 2^32, and Godot stores 0.
    expect(
      lintErrors(
        `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nshadow_item_cull_mask = 4294967296`
      )
    ).toBe(1);
  });

  it('accepts the four range-window properties as plain integers', () => {
    expect(
      lintErrors(
        `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\n` +
          `range_z_min = -1024\nrange_z_max = 1024\nrange_layer_min = 0\nrange_layer_max = 0`
      )
    ).toBe(0);
  });

  it('warns but never errors past the z hint, and stays silent on the layer hint (int32 span)', () => {
    // `Light2D::set_z_range_min` assigns with no CLAMP (`scene/2d/light_2d.cpp`),
    // so -99999 past the closed -4096..4096 hint loads: a warning (ADR-0032). The
    // layer hint spans all of int32, so 2147483647 adds no warning.
    const scene =
      `[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\n` +
      `range_z_min = -99999\nrange_layer_max = 2147483647`;
    expect(lintErrors(scene)).toBe(0);
    expect(propWarnings(scene, 'range_z_min')).toBe(1);
    expect(propWarnings(scene, 'range_layer_max')).toBe(0);
  });

  it('rejects a non-integer range window', () => {
    expect(
      lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nrange_z_max = "four"`)
    ).toBeGreaterThan(0);
    expect(
      lintErrors(`[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://light.png" id="1"]\n[node name="L" type="PointLight2D"]\nrange_layer_min = abc`)
    ).toBeGreaterThan(0);
  });
});

describe('PointLight2D keys hoisted to the Light2D tier', () => {
  it('registers only its own 4 keys directly', () => {
    expect(validatorRegistry.getOwnKeys('PointLight2D').sort()).toEqual(
      ['height', 'offset', 'texture', 'texture_scale'].sort()
    );
  });

  const HOISTED = [
    'enabled',
    'editor_only',
    'color',
    'energy',
    'blend_mode',
    'range_z_min',
    'range_z_max',
    'range_layer_min',
    'range_layer_max',
    'range_item_cull_mask',
    'shadow_enabled',
    'shadow_color',
    'shadow_filter',
    'shadow_filter_smooth',
    'shadow_item_cull_mask',
  ];

  it.each(HOISTED)("resolves '%s' to Light2D's own validator through the base-walk", (key) => {
    const owned = validatorRegistry.findValidator('Light2D', key);
    expect(owned, `Light2D does not declare '${key}'`).not.toBeNull();
    // The same function, not a shadowing copy that could drift from the tier's rule.
    expect(validatorRegistry.findValidator('PointLight2D', key)).toBe(owned);
  });
});
