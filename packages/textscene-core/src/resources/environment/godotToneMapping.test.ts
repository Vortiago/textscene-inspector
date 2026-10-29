/**
 * The tone-curve port's GLSL half: the curve per mode and the white each one bakes in. The CPU
 * half lives in `godot/rendering/environment/toneMapping.ts`.
 */

import { describe, expect, it } from 'vitest';
import { toneMappingEffectGlsl } from './godotToneMapping';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';

describe('toneMappingEffectGlsl — the curve per mode', () => {
  it('emits a function of the exposed colour with the white baked in as a constant', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.REINHARDT, 6);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color)');
    // 6² = 36, and it must be a literal GLSL accepts.
    expect(glsl).toContain('const float godotToneMapWhite = 36.0;');
    expect(glsl).not.toContain('exposure');
  });

  it('bakes AgX’s FLOORED high clip, not the authored white (regression)', () => {
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 1)).toContain('const float godotToneMapWhite = 2.0;');
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29)).toContain('const float godotToneMapWhite = 16.29;');
  });

  it('emits LINEAR as a real curve rather than leaving the caller a hole', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.LINEAR, 1);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color)');
    expect(glsl).toContain('return color;');
  });

  it('never bakes an uncompilable literal for a malformed white (error path)', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.FILMIC, Number.NaN);
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).toContain('const float godotToneMapWhite = 0.0;');
  });

  it('saturates every channel for a mode with no curve, as Godot does (error path)', () => {
    // `tonemap.glsl:266-268` sends an unknown mode down the AgX branch with the parameters
    // `environment_get_tonemap_parameters` leaves zeroed, which writes white (`pnpm ref:godot`).
    for (const mode of [5, 99, -1]) {
      expect(toneMappingEffectGlsl(mode, 1), `mode ${mode}`).toContain('return vec3(1.0);');
    }
  });

  it('carries the AgX matrices rather than three’s different approximation', () => {
    const glsl = toneMappingEffectGlsl(ToneMapper.AGX, 1);
    expect(glsl).toContain('rec709_to_rec2020_agx_inset');
    expect(glsl).toContain('agx_outset_rec2020_to_rec709');
  });
});

describe('AgX contrast — Godot’s tonemap_agx_contrast reaches the curve', () => {
  // `tonemap_agx_contrast` is `PROPERTY_HINT_RANGE, "1.0,2.0,0.01,or_greater"` at
  // `scene/resources/environment.cpp:1290`, default 1.25 (`environment.h:119`). The AgX
  // branch of `environment_get_tonemap_parameters` derives `awp_toe_a`, `awp_slope` and
  // `awp_w` from it, so it has to reach the curve.
  it('defaults to Godot’s 1.25 (happy path)', () => {
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29)).toContain('awp_contrast = 1.25;');
  });

  it('bakes an authored contrast into the curve', () => {
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 16.29, 1.8)).toContain('awp_contrast = 1.8;');
  });

  it('emits an integer contrast as a GLSL float literal (edge case)', () => {
    expect(toneMappingEffectGlsl(ToneMapper.AGX, 1, 2)).toContain('awp_contrast = 2.0;');
  });

  it('never bakes an uncompilable literal for a malformed contrast (error path)', () => {
    // Matched as an assignment, not as a bare substring: the AgX body's own
    // comments mention NaN, and GLSL has no such token to bake anyway.
    const glsl = toneMappingEffectGlsl(ToneMapper.AGX, 1, Number.NaN);
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).toContain('awp_contrast = 0.0;');
  });

  it('is ignored by every curve that is not AgX', () => {
    for (const mode of [ToneMapper.LINEAR, ToneMapper.REINHARDT, ToneMapper.FILMIC, ToneMapper.ACES]) {
      expect(toneMappingEffectGlsl(mode, 1, 1.8), `mode ${mode}`).toBe(toneMappingEffectGlsl(mode, 1, 1.25));
    }
  });
});
