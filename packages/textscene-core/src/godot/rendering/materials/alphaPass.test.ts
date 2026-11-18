import { describe, expect, it } from 'vitest';
import { AlphaAntiAliasing } from './alphaAntialiasing';
import { passMembership, usesBlendAlpha, type ShaderPassFlags } from './alphaPass';
import { BlendMode } from './blendMode';
import { DepthDrawMode } from './depthDrawMode';

const OPAQUE: ShaderPassFlags = {
  usesAlpha: false,
  usesAlphaClip: false,
  usesAlphaAntialiasing: false,
  usesDepthPrepassAlpha: false,
  hasReadScreenAlpha: false,
  usesBlendAlpha: false,
  depthDrawMode: DepthDrawMode.OPAQUE_ONLY,
  isDepthTestEnabled: true,
};

describe('passMembership', () => {
  it('keeps a shader that names no alpha in the opaque pass', () => {
    expect(passMembership(OPAQUE)).toEqual({ alphaPass: false, depthInAlphaPass: false });
  });

  it('puts a shader that names ALPHA in the alpha pass', () => {
    expect(passMembership({ ...OPAQUE, usesAlpha: true }).alphaPass).toBe(true);
  });

  it('keeps an alpha the scissor or the hash cuts in the opaque pass', () => {
    expect(passMembership({ ...OPAQUE, usesAlpha: true, usesAlphaClip: true }).alphaPass).toBe(false);
  });

  it('puts a cut alpha with an antialiased edge in the alpha pass, with its depth', () => {
    const flags = { ...OPAQUE, usesAlpha: true, usesAlphaClip: true, usesAlphaAntialiasing: true };
    expect(passMembership(flags)).toEqual({ alphaPass: true, depthInAlphaPass: true });
  });

  it('puts a read of the screen in the alpha pass, with no ALPHA', () => {
    expect(passMembership({ ...OPAQUE, hasReadScreenAlpha: true }).alphaPass).toBe(true);
  });

  it('puts a blend that reads alpha in the alpha pass', () => {
    expect(passMembership({ ...OPAQUE, usesBlendAlpha: true }).alphaPass).toBe(true);
  });

  it('draws no depth in the alpha pass for depth_prepass_alpha with no depth test', () => {
    const flags = { ...OPAQUE, usesAlpha: true, usesDepthPrepassAlpha: true, isDepthTestEnabled: false };
    expect(passMembership(flags)).toEqual({ alphaPass: true, depthInAlphaPass: false });
  });

  it('puts depth_draw_never in the alpha pass', () => {
    expect(passMembership({ ...OPAQUE, depthDrawMode: DepthDrawMode.DISABLED }).alphaPass).toBe(true);
  });
});

describe('usesBlendAlpha', () => {
  it('is false for MIX', () => {
    expect(usesBlendAlpha(BlendMode.MIX, AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF)).toBe(false);
  });

  it('is true for ADD', () => {
    expect(usesBlendAlpha(BlendMode.ADD, AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF)).toBe(true);
  });

  it('is false for ADD that alpha to coverage replaces', () => {
    expect(
      usesBlendAlpha(BlendMode.ADD, AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE)
    ).toBe(false);
  });
});
