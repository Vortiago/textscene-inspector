import { describe, expect, it } from 'vitest';
import { GLOW_LEVEL_COUNT, parseEnvironment } from './parser';
import { createEnvironmentSettings } from './renderer';
import {
  blendGlsl,
  blendsAfterToneMapping,
  brightPassGlsl,
  effectiveLevelWeights,
  GlowBlendMode,
  glowNeedsEveryPixel,
  glowParamsFor,
} from './godotGlow';

function settings(properties: Record<string, string>) {
  return createEnvironmentSettings(parseEnvironment(properties));
}

function glowOn(extra: Record<string, string> = {}) {
  const params = glowParamsFor(settings({ glow_enabled: 'true', ...extra }));
  if (!params) throw new Error('expected glow to be enabled');
  return params;
}

describe('glowParamsFor', () => {
  it('is null when the environment has no glow', () => {
    expect(glowParamsFor(settings({}))).toBeNull();
  });

  it('carries Godot 4.6 Environment defaults', () => {
    const params = glowOn();
    // `Environment`'s own constructor values — the editor preview environment
    // only flips `glow_enabled`, so these are what every previewed scene gets.
    expect(params.levels).toEqual([0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0]);
    expect(params.intensity).toBeCloseTo(0.3, 6);
    expect(params.strength).toBeCloseTo(1.0, 6);
    expect(params.bloom).toBe(0);
    expect(params.blendMode).toBe(GlowBlendMode.SCREEN);
    expect(params.hdrThreshold).toBeCloseTo(1.0, 6);
    expect(params.hdrScale).toBeCloseTo(2.0, 6);
    expect(params.luminanceCap).toBeCloseTo(12.0, 6);
  });

  it('reports the coarsest level carrying weight, so finer-only pyramids stay cheap', () => {
    // Defaults put weight on levels 2..4 (indices 1..3).
    expect(glowOn().maxLevel).toBe(3);
    expect(glowOn({ 'glow_levels/7': '0.5' }).maxLevel).toBe(6);
    // Weights at or below Godot's 0.0001 cutoff do not count as present.
    expect(glowOn({ 'glow_levels/7': '0.00005' }).maxLevel).toBe(3);
  });

  it('maxLevel is -1 when every weight is zero, so nothing can glow', () => {
    const off: Record<string, string> = {};
    for (let level = 1; level <= GLOW_LEVEL_COUNT; level++) off[`glow_levels/${level}`] = '0';
    expect(glowOn(off).maxLevel).toBe(-1);
  });

  it('sum-normalises the level weights under glow_normalized', () => {
    const params = glowOn({ glow_normalized: 'true' });
    // Defaults sum to 1.3.
    expect(params.levels[1]).toBeCloseTo(0.8 / 1.3, 6);
    expect(params.levels[2]).toBeCloseTo(0.4 / 1.3, 6);
    expect(params.levels.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 6);
  });

  it('takes glow_mix as the intensity under MIX, glow_intensity otherwise', () => {
    // Godot fills the same shader uniform from whichever the mode uses, so the
    // two are never both live.
    expect(glowOn({ glow_intensity: '0.7', glow_mix: '0.2' }).intensity).toBeCloseTo(0.7, 6);
    expect(
      glowOn({
        glow_blend_mode: String(GlowBlendMode.MIX),
        glow_intensity: '0.7',
        glow_mix: '0.2',
      }).intensity
    ).toBeCloseTo(0.2, 6);
  });

  it('blends after the tone curve only for SOFTLIGHT', () => {
    expect(blendsAfterToneMapping(glowOn())).toBe(false);
    expect(
      blendsAfterToneMapping(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }))
    ).toBe(true);
    expect(
      blendsAfterToneMapping(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }))
    ).toBe(false);
  });

  it('clamps hostile values rather than passing NaN or negatives to a shader', () => {
    const params = glowOn({
      glow_hdr_threshold: '-4',
      glow_bloom: '5',
      glow_strength: '-2',
      glow_hdr_luminance_cap: '-1',
    });
    expect(params.hdrThreshold).toBe(0);
    expect(params.bloom).toBe(1);
    expect(params.strength).toBe(0);
    expect(params.luminanceCap).toBe(0);
  });
});

describe('glowNeedsEveryPixel', () => {
  it('is false for the editor preview defaults, so a dark scene skips the pass', () => {
    expect(glowNeedsEveryPixel(glowOn())).toBe(false);
  });

  it('is true above zero glow_bloom — the feedback floor lifts even dark pixels', () => {
    expect(glowNeedsEveryPixel(glowOn({ glow_bloom: '0.2' }))).toBe(true);
  });

  it('is true for REPLACE and MIX, which rewrite every pixel even with a black glow', () => {
    expect(glowNeedsEveryPixel(glowOn({ glow_blend_mode: String(GlowBlendMode.REPLACE) }))).toBe(
      true
    );
    expect(glowNeedsEveryPixel(glowOn({ glow_blend_mode: String(GlowBlendMode.MIX) }))).toBe(true);
  });

  it('stays false for the blend modes that leave a black glow inert', () => {
    for (const mode of [GlowBlendMode.ADDITIVE, GlowBlendMode.SCREEN, GlowBlendMode.SOFTLIGHT]) {
      expect(glowNeedsEveryPixel(glowOn({ glow_blend_mode: String(mode) }))).toBe(false);
    }
  });

  it('is true below a threshold of 1, where ordinary lit surfaces bloom', () => {
    // The emissive scan only inspects materials' emission, so it cannot answer
    // whether a merely well-lit surface crosses a lowered threshold.
    expect(glowNeedsEveryPixel(glowOn({ glow_hdr_threshold: '0.5' }))).toBe(true);
    expect(glowNeedsEveryPixel(glowOn({ glow_hdr_threshold: '1' }))).toBe(false);
  });
});

describe('effectiveLevelWeights', () => {
  it('is the authored weights when glow_strength is 1', () => {
    expect(effectiveLevelWeights(glowOn())).toEqual([0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0]);
  });

  it('compounds glow_strength once per pass reaching each level', () => {
    // Level i is reached by the bright pass plus i downsamples, and Godot
    // multiplies by glow_strength at every one of them.
    const weights = effectiveLevelWeights(glowOn({ glow_strength: '2' }));
    expect(weights[1]).toBeCloseTo(0.8 * 4, 6);
    expect(weights[2]).toBeCloseTo(0.4 * 8, 6);
    expect(weights[3]).toBeCloseTo(0.1 * 16, 6);
  });

  it('keeps zero-weight levels at zero whatever the strength', () => {
    const weights = effectiveLevelWeights(glowOn({ glow_strength: '2' }));
    expect(weights[0]).toBe(0);
    expect(weights[6]).toBe(0);
  });
});

describe('brightPassGlsl', () => {
  it('gates on the peak channel with a smoothstep knee of width glow_hdr_scale', () => {
    const glsl = brightPassGlsl(glowOn());
    // Peak channel, not Rec.709 luminance: a saturated blue emissive is the
    // dimmest surface in the frame by luminance and still blooms in Godot.
    expect(glsl).toContain('max(color.r, max(color.g, color.b))');
    // threshold 1.0, threshold + hdr_scale = 3.0
    expect(glsl).toContain('smoothstep(1.0, 3.0, luminance)');
  });

  it('floors the feedback at glow_bloom and caps the result at the luminance cap', () => {
    const glsl = brightPassGlsl(glowOn({ glow_bloom: '0.25', glow_hdr_luminance_cap: '8' }));
    expect(glsl).toContain('0.25');
    expect(glsl).toContain('min(color * feedback, vec3(8.0))');
  });

  it('emits a compilable float literal for integral values', () => {
    // GLSL has no int→float coercion in a constant initialiser.
    expect(brightPassGlsl(glowOn({ glow_hdr_threshold: '2' }))).toContain('smoothstep(2.0, 4.0');
  });
});

describe('blendGlsl', () => {
  it('ADDITIVE is a plain sum', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }), 1);
    expect(glsl).toContain('return color + glow;');
  });

  it('SCREEN normalises against the tonemap white point', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 2);
    expect(glsl).toContain('clamp(glow, 0.0, 2.0)');
    expect(glsl).toContain('color + glow - (color * glow / 2.0)');
  });

  it('SOFTLIGHT uses the W3C soft-light curve and leaves values above 1 alone', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }), 1);
    expect(glsl).toContain('clamp(glow, 0.0, 1.0)');
    // D(c) = ((16c - 12)c + 4)c below 0.25, sqrt(c) above.
    expect(glsl).toContain('(16.0 * color.r - 12.0) * color.r + 4.0');
    expect(glsl).toContain('sqrt(color.r)');
    // The curve inverts past 1.0, so Godot skips it there.
    expect(glsl).toContain('color.r > 1.0');
    for (const channel of ['r', 'g', 'b']) {
      expect(glsl).toContain(`color.${channel} = color.${channel} > 1.0`);
    }
  });

  it('REPLACE discards the scene colour', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.REPLACE) }), 1);
    expect(glsl).toContain('return glow;');
  });

  it('MIX lerps against the same factor it folded into the intensity', () => {
    const glsl = blendGlsl(
      glowOn({ glow_blend_mode: String(GlowBlendMode.MIX), glow_mix: '0.25' }),
      1
    );
    expect(glsl).toContain('color * (1.0 - 0.25) + glow');
  });

  it('falls back to ADDITIVE for a blend mode outside the enum', () => {
    // `glow_blend_mode` is parsed leniently, so a scene can carry anything.
    const glsl = blendGlsl(glowOn({ glow_blend_mode: '99' }), 1);
    expect(glsl).toContain('return color + glow;');
  });

  it('emits only the constants the chosen mode reads', () => {
    // An ADDITIVE shader used to carry a white point and a mix factor it never
    // touched, which left a reader working out that both were inert.
    const additive = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }), 2);
    expect(additive).not.toContain('2.0');
    const screen = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 2);
    expect(screen).toContain('2.0');
  });
});
