import { describe, expect, it } from 'vitest';
import { GLOW_LEVEL_COUNT, decodeEnvironment } from './decode';
import { createEnvironmentSettings } from './build';
import {
  blendGlsl,
  blendsAfterToneMapping,
  unexposedBrightPassThreshold,
  brightPassGlsl,
  glowLevelSize,
  GlowBlendMode,
  glowNeedsEveryPixel,
  glowParamsFor,
} from './godotGlow';

function settings(properties: Record<string, string>) {
  return createEnvironmentSettings(decodeEnvironment(properties));
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
    // `Environment`'s own constructor values: the editor preview environment
    // only flips `glow_enabled`, so every previewed scene gets these.
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

  it('is null when every weight is zero, whatever else is set', () => {
    // An empty pyramid reads as "no glow", not as params a consumer must re-check,
    // so a non-null result always carries a real `maxLevel`.
    const off: Record<string, string> = { glow_bloom: '1', glow_intensity: '4' };
    for (let level = 1; level <= GLOW_LEVEL_COUNT; level++) off[`glow_levels/${level}`] = '0';
    expect(glowParamsFor(settings({ glow_enabled: 'true', ...off }))).toBeNull();
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

describe('unexposedBrightPassThreshold', () => {
  it('scales the threshold down by exposure, because the pass exposes before comparing', () => {
    // The bright pass multiplies by `glow_exposure` and only then compares against
    // `glow_hdr_threshold`, so at exposure 1.8 a colour peaking at 0.8 does cross a
    // threshold of 1.0. Anything measuring unexposed colour has to be held to the
    // lower bar or it disagrees with the shader about what blooms.
    expect(unexposedBrightPassThreshold(glowOn({ tonemap_exposure: '1.8' }))).toBeCloseTo(
      1 / 1.8,
      6
    );
    expect(unexposedBrightPassThreshold(glowOn())).toBeCloseTo(1, 6);
    expect(
      unexposedBrightPassThreshold(glowOn({ glow_hdr_threshold: '2', tonemap_exposure: '4' }))
    ).toBeCloseTo(0.5, 6);
  });

  it('survives a zero or negative exposure rather than dividing by it', () => {
    expect(
      Number.isFinite(unexposedBrightPassThreshold(glowOn({ tonemap_exposure: '0' })))
    ).toBe(true);
    expect(
      Number.isFinite(unexposedBrightPassThreshold(glowOn({ tonemap_exposure: '-2' })))
    ).toBe(true);
  });
});

describe('levels', () => {
  it('are the authored weights, with glow_strength deliberately NOT folded in', () => {
    // Godot multiplies by glow_strength once per pyramid pass, and on the first
    // pass that lands BEFORE the knee and the luminance cap. Folding it into the
    // weights would move it after both, so the passes apply it instead.
    expect(glowOn({ glow_strength: '2' }).levels).toEqual([0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0]);
  });
});

describe('brightPassGlsl', () => {
  it('multiplies strength then exposure BEFORE evaluating the knee', () => {
    // `copy.glsl` order: strength, exposure, then the smoothstep and the cap. A
    // knee evaluated on unexposed HDR blooms the wrong pixels entirely.
    const glsl = brightPassGlsl(glowOn({ glow_strength: '1.5', tonemap_exposure: '2' }));
    const strengthAt = glsl.indexOf('color *= 1.5;');
    const exposureAt = glsl.indexOf('color *= 2.0;');
    const kneeAt = glsl.indexOf('smoothstep(');
    expect(strengthAt).toBeGreaterThan(-1);
    expect(exposureAt).toBeGreaterThan(strengthAt);
    expect(kneeAt).toBeGreaterThan(exposureAt);
  });

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

  it('never emits a zero-width smoothstep knee', () => {
    // `smoothstep(e, e, x)` divides by the edge difference and is undefined in
    // GLSL ES, so a driver-dependent halo is the failure mode.
    const glsl = brightPassGlsl(glowOn({ glow_hdr_threshold: '1', glow_hdr_scale: '0' }));
    expect(glsl).not.toContain('smoothstep(1.0, 1.0,');
  });
});

describe('glowLevelSize', () => {
  it('puts level 0 at a QUARTER of the frame, not a half', () => {
    // Godot's glow buffer is half the internal size and its gather pass writes
    // level 0 at half of that again. Set to a half instead, every rung lands an
    // octave too fine and a coarse-weighted halo comes out far too tight.
    expect(glowLevelSize(800, 600, 0)).toEqual({ width: 200, height: 150 });
  });

  it('halves again per level', () => {
    expect(glowLevelSize(800, 600, 1)).toEqual({ width: 100, height: 75 });
    expect(glowLevelSize(800, 600, 2)).toEqual({ width: 50, height: 37 });
  });

  it('never collapses below one pixel', () => {
    // A zero-sized render target is not renderable, and the coarsest levels of a
    // small frame reach zero quickly.
    expect(glowLevelSize(8, 8, 6)).toEqual({ width: 1, height: 1 });
    expect(glowLevelSize(1, 1, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('blendGlsl', () => {
  it('ADDITIVE is a plain sum', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }), 1);
    expect(glsl).toContain('return color + glow;');
  });

  it('never divides by a zero white point', () => {
    // SCREEN is the default blend, and `tonemap_white` is only linted as
    // non-negative: a literal 0.0 divisor makes every pixel NaN.
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 0);
    expect(glsl).not.toMatch(/\/ 0\.0\s*\)/);
    expect(glsl).toContain('/ 0.0001');
  });

  it('SCREEN normalises against the tonemap white point', () => {
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 2);
    expect(glsl).toContain('clamp(glow, 0.0, 2.0)');
    expect(glsl).toContain('color + glow - (color * glow / 2.0)');
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

  it('clamps the MIX factor once, so the blend and the composite agree', () => {
    // The composite multiplies the glow buffer by `intensity` and the blend lerps
    // against it; clamping in only one of the two makes them disagree.
    const params = glowOn({ glow_blend_mode: String(GlowBlendMode.MIX), glow_mix: '4' });
    expect(params.intensity).toBe(1);
    expect(blendGlsl(params, 1)).toContain('color * (1.0 - 1.0) + glow');
  });

  it('uses Godot\'s D() coefficients, not the Photoshop soft-light variant', () => {
    // `apply_glow`'s SOFTLIGHT branch, verbatim from tonemap.glsl:
    //   color.r + glow.r * ((color.r <= 0.25
    //     ? ((16.0 * color.r - 12.0) * color.r + 4.0) * color.r
    //     : sqrt(color.r)) - color.r)
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }), 1);
    for (const channel of ['r', 'g', 'b']) {
      expect(glsl).toContain(`(16.0 * color.${channel} - 12.0) * color.${channel} + 4.0`);
      // The other branch of D(), above 0.25.
      expect(glsl).toContain(`sqrt(color.${channel})`);
    }
    // The Photoshop form lands on 3.0, not 4.0, and changes the low end of every halo.
    expect(glsl).not.toContain('+ 3.0)');
  });

  it('skips soft light above 1.0, where Godot leaves the colour alone', () => {
    // `color.r > 1.0 ? color.r : ...`: the polynomial inverts past 1, and Godot's
    // own comment calls the discontinuity there deliberate and unavoidable.
    const glsl = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }), 1);
    for (const channel of ['r', 'g', 'b']) {
      expect(glsl).toContain(`color.${channel} = color.${channel} > 1.0`);
    }
  });

  it('clamps the glow per Godot\'s own per-mode bounds', () => {
    // SOFTLIGHT clamps to [0,1]; SCREEN clamps to [0,white]. Godot's comments say
    // both exist because a negative light can drive the buffer below zero.
    expect(blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }), 4)).toContain(
      'clamp(glow, 0.0, 1.0)'
    );
    expect(blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 4)).toContain(
      'clamp(glow, 0.0, 4.0)'
    );
    // ADDITIVE and REPLACE clamp nothing at all in Godot.
    expect(blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }), 4)).not.toContain(
      'clamp('
    );
    expect(blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.REPLACE) }), 4)).not.toContain(
      'clamp('
    );
  });

  it('falls back to ADDITIVE for a blend mode outside the enum', () => {
    // `glow_blend_mode` is parsed leniently, so a scene can carry anything.
    const glsl = blendGlsl(glowOn({ glow_blend_mode: '99' }), 1);
    expect(glsl).toContain('return color + glow;');
  });

  it('emits only the constants the chosen mode reads', () => {
    // An ADDITIVE shader carries no white point or mix factor it never reads.
    const additive = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.ADDITIVE) }), 2);
    expect(additive).not.toContain('2.0');
    const screen = blendGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), 2);
    expect(screen).toContain('2.0');
  });
});
