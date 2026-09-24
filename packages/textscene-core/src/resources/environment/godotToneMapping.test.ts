/**
 * The tone-curve port's CPU half, against Godot 4.6.3's
 * `servers/rendering/storage/environment_storage.cpp`: `environment_get_white` (l. 226)
 * floors the authored white per curve, and `environment_get_tonemap_parameters` (l. 274)
 * normalises from it. Numbers are worked to full precision, not through the helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  GodotToneMapper,
  hasGodotCurve,
  resolvedWhite,
  toneMappingEffectGlsl,
  toneMappingShaderChunk,
  toneMappingWhiteParam,
} from './godotToneMapping';

describe('resolvedWhite — Godot’s environment_get_white floors', () => {
  it('passes an authored white through once it clears the floor (happy path)', () => {
    expect(resolvedWhite(GodotToneMapper.FILMIC, 6)).toBe(6);
    expect(resolvedWhite(GodotToneMapper.ACES, 6)).toBe(6);
    expect(resolvedWhite(GodotToneMapper.REINHARDT, 6)).toBe(6);
    expect(resolvedWhite(GodotToneMapper.AGX, 16.29)).toBe(16.29);
  });

  it('floors every SDR curve at 1.0, which is what keeps SCREEN glow working', () => {
    expect(resolvedWhite(GodotToneMapper.FILMIC, 0.5)).toBe(1);
    expect(resolvedWhite(GodotToneMapper.ACES, 0.5)).toBe(1);
    expect(resolvedWhite(GodotToneMapper.REINHARDT, 0.5)).toBe(1);
  });

  it('floors AgX at 2.0 — its shoulder needs the headroom (edge case)', () => {
    expect(resolvedWhite(GodotToneMapper.AGX, 1)).toBe(2);
    expect(resolvedWhite(GodotToneMapper.AGX, 0)).toBe(2);
  });

  it('ignores the authored white entirely for LINEAR, which does not normalise', () => {
    expect(resolvedWhite(GodotToneMapper.LINEAR, 6)).toBe(1);
    expect(resolvedWhite(GodotToneMapper.LINEAR, 0.1)).toBe(1);
  });

  it('lands an out-of-range mode in Godot’s own else-branch (error path)', () => {
    // `environment_get_white` tests LINEAR, then FILMIC/ACES, then AGX, and
    // falls through to Reinhard, so anything unrecognised gets `max(1, white)`.
    // `tonemap_mode` is decoded leniently, so a hand-edited scene reaches this.
    expect(resolvedWhite(99, 0.25)).toBe(1);
    expect(resolvedWhite(-1, 4)).toBe(4);
  });
});

describe('toneMappingWhiteParam — the shader’s tonemapper_params.x', () => {
  it('squares the white for REINHARDT', () => {
    expect(toneMappingWhiteParam(GodotToneMapper.REINHARDT, 1)).toBe(1);
    expect(toneMappingWhiteParam(GodotToneMapper.REINHARDT, 6)).toBe(36);
  });

  it('evaluates Hable’s biased curve at white for FILMIC', () => {
    // A = 0.22·2², B = 0.30·2, C = 0.10, D = 0.20, E = 0.01, F = 0.30.
    expect(toneMappingWhiteParam(GodotToneMapper.FILMIC, 1)).toBeCloseTo(0.5783549783549783, 12);
    expect(toneMappingWhiteParam(GodotToneMapper.FILMIC, 6)).toBeCloseTo(0.8733446519524618, 12);
  });

  it('evaluates the ACES curve at the bias-scaled white for ACES', () => {
    // Both ACES matrices have rows summing to 1, so a neutral grey passes
    // through them as a plain scale by the 1.8 exposure bias.
    expect(toneMappingWhiteParam(GodotToneMapper.ACES, 1)).toBeCloseTo(0.7810713385593705, 12);
    expect(toneMappingWhiteParam(GodotToneMapper.ACES, 6)).toBeCloseTo(0.9770112517226739, 12);
  });

  it('hands AGX the high-clip point itself, not a curve value', () => {
    expect(toneMappingWhiteParam(GodotToneMapper.AGX, 16.29)).toBe(16.29);
    expect(toneMappingWhiteParam(GodotToneMapper.AGX, 20)).toBe(20);
  });

  it('normalises by nothing for LINEAR', () => {
    expect(toneMappingWhiteParam(GodotToneMapper.LINEAR, 6)).toBe(1);
  });

  it('applies the floor before the curve, not after (regression)', () => {
    // A white under 1.0 must produce the same parameter as white = 1.0: Godot
    // floors in `environment_get_white`, upstream of every curve. Taking the
    // curve at the raw value instead would normalise against a divisor smaller
    // than 1 and blow the whole image out.
    expect(toneMappingWhiteParam(GodotToneMapper.REINHARDT, 0.5)).toBe(1);
    expect(toneMappingWhiteParam(GodotToneMapper.FILMIC, 0.5)).toBeCloseTo(
      toneMappingWhiteParam(GodotToneMapper.FILMIC, 1),
      12
    );
    expect(toneMappingWhiteParam(GodotToneMapper.ACES, 0)).toBeCloseTo(
      toneMappingWhiteParam(GodotToneMapper.ACES, 1),
      12
    );
    expect(toneMappingWhiteParam(GodotToneMapper.AGX, 1)).toBe(2);
  });

  it('falls back to no normalisation for a mode with no curve (error path)', () => {
    expect(toneMappingWhiteParam(99, 4)).toBe(1);
  });
});

describe('hasGodotCurve', () => {
  it('claims the four modes ported from Godot’s shader', () => {
    expect(hasGodotCurve(GodotToneMapper.REINHARDT)).toBe(true);
    expect(hasGodotCurve(GodotToneMapper.FILMIC)).toBe(true);
    expect(hasGodotCurve(GodotToneMapper.ACES)).toBe(true);
    expect(hasGodotCurve(GodotToneMapper.AGX)).toBe(true);
  });

  it('does not claim LINEAR — "no tone mapping" needs no curve', () => {
    expect(hasGodotCurve(GodotToneMapper.LINEAR)).toBe(false);
  });

  it('does not claim a mode outside the enum (error path)', () => {
    expect(hasGodotCurve(5)).toBe(false);
    expect(hasGodotCurve(-1)).toBe(false);
    expect(hasGodotCurve(Number.NaN)).toBe(false);
  });
});

describe('toneMappingShaderChunk — the per-material CustomToneMapping hook', () => {
  it('declares three’s hook and the two uniforms it reads', () => {
    const chunk = toneMappingShaderChunk(GodotToneMapper.FILMIC);
    expect(chunk).toContain('vec3 CustomToneMapping(vec3 color)');
    expect(chunk).toContain('uniform float toneMappingExposure;');
    expect(chunk).toContain('uniform float godotToneMapWhite;');
  });

  it('multiplies exposure in first — three does not apply it for the custom hook', () => {
    const chunk = toneMappingShaderChunk(GodotToneMapper.ACES);
    expect(chunk.indexOf('color *= toneMappingExposure;')).toBeGreaterThan(
      chunk.indexOf('vec3 CustomToneMapping(vec3 color)')
    );
  });

  it('emits the LINEAR body — exposure and nothing else — for LINEAR', () => {
    expect(toneMappingShaderChunk(GodotToneMapper.LINEAR)).toContain('return color;');
  });

  it('falls back to the LINEAR body for a mode with no curve (error path)', () => {
    expect(toneMappingShaderChunk(99)).toBe(toneMappingShaderChunk(GodotToneMapper.LINEAR));
  });

  it('carries the AgX matrices rather than three’s different approximation', () => {
    const chunk = toneMappingShaderChunk(GodotToneMapper.AGX);
    expect(chunk).toContain('rec709_to_rec2020_agx_inset');
    expect(chunk).toContain('agx_outset_rec2020_to_rec709');
    expect(chunk).toContain('awp_contrast = 1.25');
  });
});

describe('toneMappingEffectGlsl — the same curves for the glow composer', () => {
  it('emits an exposure-taking function with the white baked in as a constant', () => {
    const glsl = toneMappingEffectGlsl(GodotToneMapper.REINHARDT, 6);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    // 6² = 36, and it must be a literal GLSL accepts.
    expect(glsl).toContain('const float godotToneMapWhite = 36.0;');
    expect(glsl).toContain('color *= exposure;');
  });

  it('bakes AgX’s FLOORED high clip, not the authored white (regression)', () => {
    expect(toneMappingEffectGlsl(GodotToneMapper.AGX, 1)).toContain(
      'const float godotToneMapWhite = 2.0;'
    );
    expect(toneMappingEffectGlsl(GodotToneMapper.AGX, 16.29)).toContain(
      'const float godotToneMapWhite = 16.29;'
    );
  });

  it('emits LINEAR as a real curve rather than leaving the caller a hole', () => {
    const glsl = toneMappingEffectGlsl(GodotToneMapper.LINEAR, 1);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('return color;');
  });

  it('never bakes an uncompilable literal for a malformed white (error path)', () => {
    const glsl = toneMappingEffectGlsl(GodotToneMapper.FILMIC, Number.NaN);
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).toContain('const float godotToneMapWhite = 0.0;');
  });

  it('agrees with the per-material chunk about which curve a mode gets', () => {
    // The two paths must draw the same scene identically. The composer moves where
    // the curve runs, never which one.
    for (const mode of [0, 1, 2, 3, 4]) {
      const shared = toneMappingShaderChunk(mode).includes('rec709_to_rec2020_agx_inset');
      expect(toneMappingEffectGlsl(mode, 1).includes('rec709_to_rec2020_agx_inset')).toBe(shared);
    }
  });
});

describe('AgX contrast — Godot’s tonemap_agx_contrast reaches the curve', () => {
  // `tonemap_agx_contrast` is `PROPERTY_HINT_RANGE, "1.0,2.0,0.01,or_greater"` at
  // `scene/resources/environment.cpp:1290`, default 1.25 (`environment.h:119`). The AgX
  // branch of `environment_get_tonemap_parameters` derives `awp_toe_a`, `awp_slope` and
  // `awp_w` from it, so it has to reach the curve.
  it('defaults to Godot’s 1.25 on both paths (happy path)', () => {
    expect(toneMappingShaderChunk(GodotToneMapper.AGX)).toContain('awp_contrast = 1.25;');
    expect(toneMappingEffectGlsl(GodotToneMapper.AGX, 16.29)).toContain('awp_contrast = 1.25;');
  });

  it('bakes an authored contrast into the in-material chunk', () => {
    expect(toneMappingShaderChunk(GodotToneMapper.AGX, 1.8)).toContain('awp_contrast = 1.8;');
  });

  it('bakes the SAME authored contrast into the composer path', () => {
    // The two paths differ only in where the curve runs. A contrast that reached one
    // and not the other would change the picture the moment glow mounted, the class
    // of divergence ADR-0031 exists for.
    expect(toneMappingEffectGlsl(GodotToneMapper.AGX, 16.29, 1.8)).toContain(
      'awp_contrast = 1.8;'
    );
  });

  it('emits an integer contrast as a GLSL float literal (edge case)', () => {
    expect(toneMappingShaderChunk(GodotToneMapper.AGX, 2)).toContain('awp_contrast = 2.0;');
  });

  it('never bakes an uncompilable literal for a malformed contrast (error path)', () => {
    // Matched as an assignment, not as a bare substring: the AgX body's own
    // comments mention NaN, and GLSL has no such token to bake anyway.
    const chunk = toneMappingShaderChunk(GodotToneMapper.AGX, Number.NaN);
    expect(chunk).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(chunk).toContain('awp_contrast = 0.0;');
  });

  it('is ignored by every curve that is not AgX', () => {
    for (const mode of [
      GodotToneMapper.LINEAR,
      GodotToneMapper.REINHARDT,
      GodotToneMapper.FILMIC,
      GodotToneMapper.ACES,
    ]) {
      expect(toneMappingShaderChunk(mode, 1.8), `mode ${mode}`).toBe(
        toneMappingShaderChunk(mode, 1.25)
      );
    }
  });
});
