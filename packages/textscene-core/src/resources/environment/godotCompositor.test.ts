/**
 * The composite shader against Godot 4.6.3's `tonemap.glsl` `main()`
 * (`servers/rendering/renderer_rd/shaders/effects/`): exposure on the scene once, a
 * glow blend (MIX lerps), `apply_tonemapping` (max(0), then the curve), then SOFTLIGHT.
 * Assertions read that structure, never a GLSL snapshot, which names no broken invariant.
 */

import { describe, expect, it } from 'vitest';
import { compositeGlsl } from './godotCompositor';
import { decodeEnvironment } from './decode';
import { createEnvironmentSettings } from './build';
import { GlowBlendMode, glowParamsFor, type GlowParams } from './godotGlow';
import { GodotToneMapper } from './godotToneMapping';

function glowOn(extra: Record<string, string> = {}): GlowParams {
  const params = glowParamsFor(
    createEnvironmentSettings(decodeEnvironment({ glow_enabled: 'true', ...extra }))
  );
  if (!params) throw new Error('expected glow to be enabled');
  return params;
}

/** `mainImage`'s body: above it sit the definitions, not the call order. */
function body(params: GlowParams | null, toneMapping = { mode: GodotToneMapper.FILMIC, white: 1 }) {
  const glsl = compositeGlsl(params, toneMapping);
  return glsl.slice(glsl.indexOf('void mainImage'));
}

describe('compositeGlsl — the shader it emits', () => {
  it('is self-contained: the curve and the blend are defined above mainImage', () => {
    // The effect compiles this one string. A function it only calls would be a
    // link error at shader-compile time: a black frame.
    const glsl = compositeGlsl(glowOn(), { mode: GodotToneMapper.FILMIC, white: 1 });
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('vec3 godotGlowBlend(vec3 color, vec3 glow)');
    expect(glsl).toContain('void mainImage(const in vec4 inputColor, const in vec2 uv,');
  });

  it('declares the two uniforms the pass feeds it', () => {
    const glsl = compositeGlsl(glowOn(), { mode: GodotToneMapper.FILMIC, white: 1 });
    expect(glsl).toContain('uniform sampler2D godotGlowBuffer;');
    expect(glsl).toContain('uniform float godotExposure;');
  });

  it('preserves the input alpha rather than writing the blended one', () => {
    expect(body(glowOn())).toContain('outputColor = vec4(color, inputColor.a);');
  });
});

describe('compositeGlsl — the glow gather', () => {
  it('scales the gathered buffer by glow_intensity, as gather_glow’s caller does', () => {
    expect(body(glowOn({ glow_intensity: '0.75' }))).toContain(
      'texture2D(godotGlowBuffer, uv).rgb * 0.75'
    );
  });

  it('gives MIX the glow_mix factor in the intensity slot Godot reuses', () => {
    // Godot fills the same uniform from `glow_mix` under MIX and lerps against
    // it, so the scale on the buffer and the lerp factor are one value.
    const glsl = body(glowOn({ glow_blend_mode: String(GlowBlendMode.MIX), glow_mix: '0.4' }));
    expect(glsl).toContain('texture2D(godotGlowBuffer, uv).rgb * 0.4');
  });
});

describe('compositeGlsl — exposure', () => {
  // `tonemap.glsl` runs `color.rgb *= exposure` on the scene once before the blend;
  // the bright pass already exposed the glow. Every glow fixture leaves
  // `tonemap_exposure` at 1.0, where a double-exposed glow or a scaled sum looks the same.
  it('exposes the scene colour and leaves the glow alone, pre-tonemap modes', () => {
    const glsl = compositeGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: GodotToneMapper.FILMIC,
      white: 1,
    });
    expect(glsl).toContain('* godotExposure');
    expect(glsl).toContain('godotToneMap(color, 1.0)');
    expect(glsl).not.toMatch(/glow[^;]*godotExposure/);
  });

  it('applies exposure exactly once, whichever side of the curve blends', () => {
    for (const mode of [GlowBlendMode.SCREEN, GlowBlendMode.SOFTLIGHT, GlowBlendMode.MIX]) {
      const occurrences = body(glowOn({ glow_blend_mode: String(mode) })).match(
        /godotExposure/g
      );
      expect(occurrences, `blend mode ${mode}`).toHaveLength(1);
    }
  });

  it('calls the curve with an exposure of 1.0 — each operand is exposed already', () => {
    const glsl = body(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }));
    expect(glsl).toContain('godotToneMap(glow, 1.0)');
    expect(glsl).toContain('godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0)');
  });

  it('clamps the scene colour non-negative before the curve, as apply_tonemapping does', () => {
    // Godot: "Ensure color values passed to tonemappers are positive. They can
    // be negative in the case of negative lights".
    expect(body(glowOn())).toContain('max(inputColor.rgb, 0.0)');
  });
});

describe('compositeGlsl — which side of the tone curve the blend falls on', () => {
  it('tonemaps both operands and neither twice, SOFTLIGHT', () => {
    const glsl = compositeGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }), {
      mode: GodotToneMapper.FILMIC,
      white: 1,
    });
    expect(glsl).toContain('godotToneMap(glow, 1.0)');
    expect(glsl).not.toMatch(/glow[^;]*godotExposure/);
  });

  it('blends before the tone curve for SCREEN and after it for SOFTLIGHT', () => {
    const screen = body(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }));
    const softlight = body(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }));
    expect(screen.indexOf('godotGlowBlend')).toBeLessThan(screen.indexOf('godotToneMap(color'));
    expect(softlight.indexOf('godotToneMap(max')).toBeLessThan(softlight.indexOf('godotGlowBlend'));
  });

  it('puts every non-SOFTLIGHT mode on the pre-tonemap side (edge case)', () => {
    for (const mode of [
      GlowBlendMode.ADDITIVE,
      GlowBlendMode.SCREEN,
      GlowBlendMode.REPLACE,
      GlowBlendMode.MIX,
    ]) {
      const glsl = body(glowOn({ glow_blend_mode: String(mode) }));
      expect(glsl.indexOf('godotGlowBlend'), `blend mode ${mode}`).toBeLessThan(
        glsl.indexOf('godotToneMap(color')
      );
    }
  });
});

describe('compositeGlsl — the white SCREEN normalises against', () => {
  it('uses Godot’s FLOORED white, not the authored property (regression)', () => {
    // `apply_glow` divides by `params.white`, which `renderer_scene_render_rd.cpp` fills
    // from `environment_get_white`, floored at 1.0 for every SDR curve: "white cannot be
    // smaller than the maximum output value". A raw `tonemap_white` below 1 blows the glow out.
    const glsl = compositeGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: GodotToneMapper.FILMIC,
      white: 0.5,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 1.0)');
    expect(glsl).toContain('color * glow / 1.0');
    expect(glsl).not.toContain('color * glow / 0.5');
  });

  it('passes an authored white above the floor straight through', () => {
    const glsl = compositeGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: GodotToneMapper.FILMIC,
      white: 6,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 6.0)');
    expect(glsl).toContain('color * glow / 6.0');
  });

  it('normalises SCREEN against 1.0 under LINEAR, which has no white', () => {
    // `environment_get_white` returns `output_max_value` for LINEAR whatever the
    // scene authored.
    const glsl = compositeGlsl(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: GodotToneMapper.LINEAR,
      white: 6,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 1.0)');
  });
});

describe('compositeGlsl — malformed input', () => {
  it('falls back to ADDITIVE for a blend mode outside the enum (error path)', () => {
    // `glow_blend_mode` is decoded leniently, so a hand-edited scene can carry
    // anything. An unknown mode must still compile.
    expect(body(glowOn({ glow_blend_mode: '99' }))).toContain('godotGlowBlend');
    expect(compositeGlsl(glowOn({ glow_blend_mode: '99' }), {
      mode: GodotToneMapper.FILMIC,
      white: 1,
    })).toContain('return color + glow;');
  });

  it('emits no uncompilable literal for a malformed tonemap white (error path)', () => {
    const glsl = compositeGlsl(glowOn(), { mode: GodotToneMapper.FILMIC, white: Number.NaN });
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).not.toMatch(/\*\s*(NaN|Infinity)/);
  });

  it('emits no uncompilable literal for a malformed glow intensity (error path)', () => {
    const glsl = compositeGlsl(glowOn({ glow_intensity: 'not-a-number' }), {
      mode: GodotToneMapper.FILMIC,
      white: 1,
    });
    expect(glsl).not.toMatch(/[=*]\s*(NaN|Infinity)/);
  });
});

describe('compositeGlsl — the AgX contrast', () => {
  it('threads an authored tonemap_agx_contrast into the composed curve', () => {
    const glsl = compositeGlsl(glowOn(), {
      mode: GodotToneMapper.AGX,
      white: 16.29,
      agxContrast: 1.8,
    });
    expect(glsl).toContain('awp_contrast = 1.8;');
  });

  it('falls back to Godot’s default when the caller omits it (edge case)', () => {
    const glsl = compositeGlsl(glowOn(), { mode: GodotToneMapper.AGX, white: 16.29 });
    expect(glsl).toContain('awp_contrast = 1.25;');
  });
});

describe('compositeGlsl — with the glow flag clear', () => {
  // `tonemap.glsl:859-899` guards every glow line on FLAG_USE_GLOW. With it clear,
  // the same pass reduces to exposure and the curve.
  const tone = { mode: GodotToneMapper.FILMIC, white: 1 };

  it('exposes the scene colour and applies the curve, in that order', () => {
    expect(body(null, tone)).toContain('godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0)');
  });

  it('gathers no glow and declares no buffer to gather from', () => {
    const glsl = compositeGlsl(null, tone);
    expect(glsl).not.toContain('godotGlowBuffer');
    expect(glsl).not.toContain('godotGlowBlend');
    expect(glsl).toContain('uniform float godotExposure;');
  });

  it('preserves the input alpha, as the glow arm does', () => {
    expect(body(null, tone)).toContain('outputColor = vec4(color, inputColor.a);');
  });

  it('still emits a real curve under LINEAR, which is exposure and nothing else', () => {
    const glsl = compositeGlsl(null, { mode: GodotToneMapper.LINEAR, white: 1 });
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('* godotExposure');
  });
});
