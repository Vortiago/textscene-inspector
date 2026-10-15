/**
 * The composite shader against Godot 4.6.3's `tonemap.glsl` `main()`
 * (`servers/rendering/renderer_rd/shaders/effects/`): exposure on the scene once, a
 * glow blend (MIX lerps), `apply_tonemapping` (max(0), then the curve), then SOFTLIGHT.
 * Assertions read that structure, never a GLSL snapshot, which names no broken invariant.
 */

import { describe, expect, it } from 'vitest';
import { compositeProgram, GLOW_BUFFER_UNIFORM, GLOW_MAP_UNIFORM } from './godotCompositor';
import { decodeEnvironment } from './decode';
import { createEnvironmentSettings } from './build';
import { glowParamsFor, type GlowParams } from './godotGlow';
import { GlowBlendMode } from '../../godot/rendering/environment/glow.js';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';
import type { EnvironmentAdjustments } from './types';
import type { CompositeToneMapping } from './godotCompositor';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';

function glowOn(extra: Record<string, string> = {}): GlowParams {
  const params = glowParamsFor(
    createEnvironmentSettings(decodeEnvironment({ glow_enabled: 'true', ...extra }), DEFAULT_CLEAR_COLOR)
  );
  if (!params) throw new Error('expected glow to be enabled');
  return params;
}

const FILMIC: CompositeToneMapping = { mode: ToneMapper.FILMIC, white: 1 };

/** The whole shader with `FLAG_USE_BCS` clear. */
function composite(glow: GlowParams | null, toneMapping: CompositeToneMapping = FILMIC): string {
  return shaderOf(glow, toneMapping, null);
}

function shaderOf(
  glow: GlowParams | null,
  toneMapping: CompositeToneMapping,
  adjustments: EnvironmentAdjustments | null
): string {
  return compositeProgram({ glow, toneMapping, adjustments, exposure: 1 }).fragmentShader;
}

/** `mainImage`'s body: above it sit the definitions, not the call order. */
function body(
  glow: GlowParams | null,
  toneMapping: CompositeToneMapping = FILMIC,
  adjustments: EnvironmentAdjustments | null = null
) {
  const glsl = shaderOf(glow, toneMapping, adjustments);
  return glsl.slice(glsl.indexOf('void mainImage'));
}

describe('compositeProgram — the shader it emits', () => {
  it('is self-contained: the curve and the blend are defined above mainImage', () => {
    // The effect compiles this one string. A function it only calls would be a
    // link error at shader-compile time: a black frame.
    const glsl = composite(glowOn());
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('vec3 godotGlowBlend(vec3 color, vec3 glow)');
    expect(glsl).toContain('void mainImage(const in vec4 inputColor, const in vec2 uv,');
  });

  it('declares the two uniforms the pass feeds it', () => {
    const glsl = composite(glowOn());
    expect(glsl).toContain('uniform sampler2D godotGlowBuffer;');
    expect(glsl).toContain('uniform float godotExposure;');
  });

  it('preserves the input alpha rather than writing the blended one', () => {
    expect(body(glowOn())).toContain('outputColor = vec4(color, inputColor.a);');
  });
});

describe('compositeProgram — the glow gather', () => {
  it('scales the gathered buffer by glow_intensity, as gather_glow’s caller does', () => {
    expect(body(glowOn({ glow_intensity: '0.75' }))).toContain('texture2D(godotGlowBuffer, uv).rgb * 0.75');
  });

  it('gives MIX the glow_mix factor in the intensity slot Godot reuses', () => {
    // Godot fills the same uniform from `glow_mix` under MIX and lerps against
    // it, so the scale on the buffer and the lerp factor are one value.
    const glsl = body(glowOn({ glow_blend_mode: String(GlowBlendMode.MIX), glow_mix: '0.4' }));
    expect(glsl).toContain('texture2D(godotGlowBuffer, uv).rgb * 0.4');
  });
});

describe('compositeProgram — the glow map', () => {
  const MAP = { glow_map: 'SubResource("Gradient_1")' };

  it('scales the gathered glow by the map, mixed in by glow_map_strength (tonemap.glsl:886)', () => {
    const glsl = composite(glowOn({ ...MAP, glow_map_strength: '0.6' }));
    expect(glsl).toContain('uniform sampler2D godotGlowMap;');
    expect(glsl).toContain('glow = mix(glow, texture2D(godotGlowMap, uv).rgb * glow, 0.6);');
  });

  it('applies the map before the SOFTLIGHT tone curve too (tonemap.glsl:908)', () => {
    const glsl = body(glowOn({ ...MAP, glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }));
    const mapAt = glsl.indexOf('godotGlowMap');
    expect(mapAt).toBeGreaterThan(-1);
    expect(mapAt).toBeLessThan(glsl.indexOf('godotToneMap(glow'));
  });

  it('declares no map sampler without a map', () => {
    expect(composite(glowOn())).not.toContain('godotGlowMap');
  });
});

describe('compositeProgram — exposure', () => {
  // `tonemap.glsl` runs `color.rgb *= exposure` on the scene once before the blend;
  // the bright pass already exposed the glow. Every glow fixture leaves
  // `tonemap_exposure` at 1.0, where a double-exposed glow or a scaled sum looks the same.
  it('exposes the scene colour and leaves the glow alone, pre-tonemap modes', () => {
    const glsl = composite(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }));
    expect(glsl).toContain('* godotExposure');
    expect(glsl).toContain('godotToneMap(color, 1.0)');
    expect(glsl).not.toMatch(/glow[^;]*godotExposure/);
  });

  it('applies exposure exactly once, whichever side of the curve blends', () => {
    for (const mode of [GlowBlendMode.SCREEN, GlowBlendMode.SOFTLIGHT, GlowBlendMode.MIX]) {
      const occurrences = body(glowOn({ glow_blend_mode: String(mode) })).match(/godotExposure/g);
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

describe('compositeProgram — which side of the tone curve the blend falls on', () => {
  it('tonemaps both operands and neither twice, SOFTLIGHT', () => {
    const glsl = composite(glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }));
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

describe('compositeProgram — the white SCREEN normalises against', () => {
  it('uses Godot’s FLOORED white, not the authored property (regression)', () => {
    // `apply_glow` divides by `params.white`, which `renderer_scene_render_rd.cpp` fills
    // from `environment_get_white`, floored at 1.0 for every SDR curve: "white cannot be
    // smaller than the maximum output value". A raw `tonemap_white` below 1 blows the glow out.
    const glsl = composite(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: ToneMapper.FILMIC,
      white: 0.5,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 1.0)');
    expect(glsl).toContain('color * glow / 1.0');
    expect(glsl).not.toContain('color * glow / 0.5');
  });

  it('passes an authored white above the floor straight through', () => {
    const glsl = composite(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: ToneMapper.FILMIC,
      white: 6,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 6.0)');
    expect(glsl).toContain('color * glow / 6.0');
  });

  it('normalises SCREEN against 1.0 under LINEAR, which has no white', () => {
    // `environment_get_white` returns `output_max_value` for LINEAR whatever the
    // scene authored.
    const glsl = composite(glowOn({ glow_blend_mode: String(GlowBlendMode.SCREEN) }), {
      mode: ToneMapper.LINEAR,
      white: 6,
    });
    expect(glsl).toContain('clamp(glow, 0.0, 1.0)');
  });
});

describe('compositeProgram — malformed input', () => {
  it('falls back to ADDITIVE for a blend mode outside the enum (error path)', () => {
    // `glow_blend_mode` is decoded leniently, so a hand-edited scene can carry
    // anything. An unknown mode must still compile.
    expect(body(glowOn({ glow_blend_mode: '99' }))).toContain('godotGlowBlend');
    expect(composite(glowOn({ glow_blend_mode: '99' }))).toContain('return color + glow;');
  });

  it('emits no uncompilable literal for a malformed tonemap white (error path)', () => {
    const glsl = composite(glowOn(), { mode: ToneMapper.FILMIC, white: Number.NaN });
    expect(glsl).not.toMatch(/=\s*(NaN|Infinity)/);
    expect(glsl).not.toMatch(/\*\s*(NaN|Infinity)/);
  });

  it('emits no uncompilable literal for a malformed glow intensity (error path)', () => {
    const glsl = composite(glowOn({ glow_intensity: 'not-a-number' }));
    expect(glsl).not.toMatch(/[=*]\s*(NaN|Infinity)/);
  });
});

describe('compositeProgram — the AgX contrast', () => {
  it('threads an authored tonemap_agx_contrast into the composed curve', () => {
    const glsl = composite(glowOn(), { mode: ToneMapper.AGX, white: 16.29, agxContrast: 1.8 });
    expect(glsl).toContain('awp_contrast = 1.8;');
  });

  it('falls back to Godot’s default when the caller omits it (edge case)', () => {
    const glsl = composite(glowOn(), { mode: ToneMapper.AGX, white: 16.29 });
    expect(glsl).toContain('awp_contrast = 1.25;');
  });
});

describe('compositeProgram — with the glow flag clear', () => {
  // `tonemap.glsl:859-899` guards every glow line on FLAG_USE_GLOW. With it clear,
  // the same pass reduces to exposure and the curve.
  const tone = { mode: ToneMapper.FILMIC, white: 1 };

  it('exposes the scene colour and applies the curve, in that order', () => {
    expect(body(null, tone)).toContain('godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0)');
  });

  it('gathers no glow and declares no buffer to gather from', () => {
    const glsl = composite(null, tone);
    expect(glsl).not.toContain('godotGlowBuffer');
    expect(glsl).not.toContain('godotGlowBlend');
    expect(glsl).toContain('uniform float godotExposure;');
  });

  it('preserves the input alpha, as the glow arm does', () => {
    expect(body(null, tone)).toContain('outputColor = vec4(color, inputColor.a);');
  });

  it('still emits a real curve under LINEAR, which is exposure and nothing else', () => {
    const glsl = composite(null, { mode: ToneMapper.LINEAR, white: 1 });
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('* godotExposure');
  });
});

describe('compositeProgram — the adjustments (FLAG_USE_BCS, tonemap.glsl:916-949)', () => {
  const tone = { mode: ToneMapper.LINEAR, white: 1 };
  const neutral: EnvironmentAdjustments = { brightness: 1, contrast: 1, saturation: 1 };

  function adjusted(adjustments: Partial<EnvironmentAdjustments>, glow: GlowParams | null = null) {
    return body(glow, tone, { ...neutral, ...adjustments });
  }

  it('scales the linear colour by the brightness, before the sRGB encode', () => {
    const glsl = adjusted({ brightness: 1.3 });
    expect(glsl).toContain('color *= 1.3;');
    expect(glsl.indexOf('color *= 1.3;')).toBeLessThan(glsl.indexOf('godotToSrgb(color)'));
  });

  it('mixes the sRGB colour towards 0.5 by the contrast', () => {
    const glsl = adjusted({ contrast: 1.25 });
    expect(glsl).toContain('color = mix(vec3(0.5), color, 1.25);');
    expect(glsl.indexOf('godotToSrgb(color)')).toBeLessThan(glsl.indexOf('mix(vec3(0.5)'));
  });

  it('mixes the sRGB colour towards its equal-weight grey by the saturation', () => {
    const glsl = adjusted({ saturation: 0.5 });
    expect(glsl).toContain('color = mix(vec3(dot(vec3(1.0), color) / 3.0), color, 0.5);');
    expect(glsl.indexOf('mix(vec3(0.5)')).toBeLessThan(glsl.indexOf('mix(vec3(dot('));
  });

  it('decodes back to linear last, since the composer encodes the output itself', () => {
    const glsl = adjusted({});
    expect(glsl.indexOf('mix(vec3(dot(')).toBeLessThan(glsl.indexOf('godotToLinear('));
    expect(glsl.indexOf('godotToLinear(')).toBeLessThan(glsl.indexOf('outputColor ='));
  });

  it('clamps the sRGB colour at 0 before the decode, since the output encode cannot take a negative', () => {
    expect(adjusted({ contrast: 2 })).toContain('color = godotToLinear(max(color, vec3(0.0)));');
  });

  it('keeps a brightness of 0, which draws the whole frame black (edge case)', () => {
    expect(adjusted({ brightness: 0 })).toContain('color *= 0.0;');
  });

  it('greys a saturation of 0 to the equal-weight mean, not a luminance (edge case)', () => {
    const glsl = adjusted({ saturation: 0 });
    expect(glsl).toContain('color = mix(vec3(dot(vec3(1.0), color) / 3.0), color, 0.0);');
    expect(glsl).not.toMatch(/0\.2126|0\.299/);
  });

  it('adjusts after the tone curve and after the SOFTLIGHT glow blend', () => {
    const glsl = adjusted({}, glowOn({ glow_blend_mode: String(GlowBlendMode.SOFTLIGHT) }));
    expect(glsl.indexOf('godotGlowBlend(color, godotToneMap(glow')).toBeLessThan(
      glsl.indexOf('godotToSrgb(color)')
    );
  });

  it('adds no adjustment step when adjustment_enabled is false', () => {
    const glsl = composite(null, tone);
    expect(glsl).not.toContain('godotToSrgb');
    expect(glsl).not.toContain('godotToLinear');
  });

  it('emits no uncompilable literal for a malformed adjustment (error path)', () => {
    const glsl = adjusted({ brightness: Number.NaN, contrast: Number.POSITIVE_INFINITY });
    expect(glsl).not.toMatch(/[=*,]\s*(NaN|Infinity)/);
  });
});

describe('compositeProgram — the uniforms it returns', () => {
  const GLOW_MAP = { glow_map: 'SubResource("Gradient_1")' };

  function program(glow: GlowParams | null, exposure = 1) {
    return compositeProgram({ glow, toneMapping: FILMIC, adjustments: null, exposure });
  }

  function declaredUniforms(fragmentShader: string): string[] {
    return [...fragmentShader.matchAll(/^uniform \w+ (\w+);$/gm)].map((match) => match[1]!);
  }

  it.each([
    ['no glow', null],
    ['a glow', glowOn()],
    ['a glow map', glowOn(GLOW_MAP)],
  ])('lists exactly the uniforms the shader declares, with %s', (_label, glow) => {
    const { fragmentShader, uniforms } = program(glow);
    expect(Object.keys(uniforms).sort()).toEqual(declaredUniforms(fragmentShader).sort());
  });

  it('adds the glow buffer with a glow and the glow map with a map', () => {
    expect(Object.keys(program(glowOn()).uniforms)).toEqual(['godotExposure', GLOW_BUFFER_UNIFORM]);
    expect(Object.keys(program(glowOn(GLOW_MAP)).uniforms)).toEqual([GLOW_BUFFER_UNIFORM, GLOW_MAP_UNIFORM]);
  });

  it('starts the exposure at the authored value and each texture unbound', () => {
    const { uniforms } = program(glowOn(GLOW_MAP), 2.5);
    expect(uniforms['godotExposure']).toBe(2.5);
    expect(uniforms[GLOW_BUFFER_UNIFORM]).toBeNull();
    expect(uniforms[GLOW_MAP_UNIFORM]).toBeNull();
  });
});
