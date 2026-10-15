/**
 * The tone-curve port's GLSL half: the curve per mode and the white each one bakes in. The CPU
 * half lives in `godot/rendering/environment/toneMapping.ts`.
 */

import { describe, expect, it } from 'vitest';
import { toneMappingEffectGlsl, toneMappingShaderChunk } from './godotToneMapping';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';

describe('toneMappingShaderChunk — the per-material CustomToneMapping hook', () => {
  it('declares three’s hook and the exposure uniform it reads', () => {
    const chunk = toneMappingShaderChunk(ToneMapper.FILMIC, 1);
    expect(chunk).toContain('vec3 CustomToneMapping(vec3 color)');
    expect(chunk).toContain('uniform float toneMappingExposure;');
  });

  it('bakes the white in as a constant, as the glow composer does', () => {
    // 6² = 36, and it must be a literal GLSL accepts.
    expect(toneMappingShaderChunk(ToneMapper.REINHARDT, 6)).toContain(
      'const float godotToneMapWhite = 36.0;'
    );
  });

  it('multiplies exposure in first — three does not apply it for the custom hook', () => {
    const chunk = toneMappingShaderChunk(ToneMapper.ACES, 1);
    expect(chunk.indexOf('color *= toneMappingExposure;')).toBeGreaterThan(
      chunk.indexOf('vec3 CustomToneMapping(vec3 color)')
    );
  });

  it('emits the LINEAR body — exposure and nothing else — for LINEAR', () => {
    expect(toneMappingShaderChunk(ToneMapper.LINEAR, 1)).toContain('return color;');
  });

  it('falls back to the LINEAR body for a mode with no curve (error path)', () => {
    expect(toneMappingShaderChunk(99, 1)).toBe(toneMappingShaderChunk(ToneMapper.LINEAR, 1));
  });

  it('carries the AgX matrices rather than three’s different approximation', () => {
    const chunk = toneMappingShaderChunk(ToneMapper.AGX, 1);
    expect(chunk).toContain('rec709_to_rec2020_agx_inset');
    expect(chunk).toContain('agx_outset_rec2020_to_rec709');
    expect(chunk).toContain('awp_contrast = 1.25');
  });
});

describe('toneMappingEffectGlsl — the same curves for the glow composer', () => {
  it('emits an exposure-taking function with the white baked in as a constant', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.REINHARDT, 6);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    // 6² = 36, and it must be a literal GLSL accepts.
    expect(glsl).toContain('const float godotToneMapWhite = 36.0;');
    expect(glsl).toContain('color *= exposure;');
  });

  it('bakes AgX’s FLOORED high clip, not the authored white (regression)', () => {
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 1)).toContain('const float godotToneMapWhite = 2.0;');
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29)).toContain('const float godotToneMapWhite = 16.29;');
  });

  it('emits LINEAR as a real curve rather than leaving the caller a hole', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.LINEAR, 1);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('return color;');
  });

  it('never bakes an uncompilable literal for a malformed white (error path)', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.FILMIC, Number.NaN);
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).toContain('const float godotToneMapWhite = 0.0;');
  });

  it('agrees with the per-material chunk about which curve a mode gets', () => {
    // The two paths must draw the same scene identically. The composer moves where
    // the curve runs, never which one.
    for (const mode of [0, 1, 2, 3, 4]) {
      const shared = toneMappingShaderChunk(mode, 1).includes('rec709_to_rec2020_agx_inset');
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
    expect(toneMappingShaderChunk(ToneMapper.AGX, 1)).toContain('awp_contrast = 1.25;');
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29)).toContain('awp_contrast = 1.25;');
  });

  it('bakes an authored contrast into the in-material chunk', () => {
    expect(toneMappingShaderChunk(ToneMapper.AGX, 1, 1.8)).toContain('awp_contrast = 1.8;');
  });

  it('bakes the SAME authored contrast into the composer path', () => {
    // The two paths differ only in where the curve runs. A contrast that reached one
    // and not the other would change the picture the moment glow mounted, the class
    // of divergence ADR-0031 exists for.
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29, 1.8)).toContain('awp_contrast = 1.8;');
  });

  it('emits an integer contrast as a GLSL float literal (edge case)', () => {
    expect(toneMappingShaderChunk(ToneMapper.AGX, 1, 2)).toContain('awp_contrast = 2.0;');
  });

  it('never bakes an uncompilable literal for a malformed contrast (error path)', () => {
    // Matched as an assignment, not as a bare substring: the AgX body's own
    // comments mention NaN, and GLSL has no such token to bake anyway.
    const chunk = toneMappingShaderChunk(ToneMapper.AGX, 1, Number.NaN);
    expect(chunk).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(chunk).toContain('awp_contrast = 0.0;');
  });

  it('is ignored by every curve that is not AgX', () => {
    for (const mode of [ToneMapper.LINEAR, ToneMapper.REINHARDT, ToneMapper.FILMIC, ToneMapper.ACES]) {
      expect(toneMappingShaderChunk(mode, 1, 1.8), `mode ${mode}`).toBe(
        toneMappingShaderChunk(mode, 1, 1.25)
      );
    }
  });
});
