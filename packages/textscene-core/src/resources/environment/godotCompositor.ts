/**
 * Godot's `tonemap.glsl` `main()`: one fragment shader from a glow blend and a tone
 * curve. Its own module, so asking "does this environment glow?" pulls in no tone
 * curve, and the in-material tonemap path pulls in no glow.
 */

/*
 * Ported from Godot 4.6's `servers/rendering/renderer_rd/shaders/effects/tonemap.glsl`,
 * used under the MIT licence: see THIRD-PARTY-NOTICES.md.
 */

import { blendGlsl, blendsAfterToneMapping, type GlowParams } from './godotGlow';
import { glslFloat } from './glslLiterals';
import { resolvedWhite, toneMappingEffectGlsl } from './godotToneMapping';
import type { EnvironmentAdjustments, EnvironmentSettings } from './types';
import { GODOT_TO_LINEAR_GLSL, GODOT_TO_SRGB_GLSL } from '../../godot/srgbTransfer';

export type CompositeToneMapping = Pick<EnvironmentSettings['toneMapping'], 'mode' | 'white'> & {
  agxContrast?: number;
};

/** One field per `tonemap.glsl` flag group. A null clears that flag. */
export interface CompositeOptions {
  glow: GlowParams | null;
  toneMapping: CompositeToneMapping;
  adjustments: EnvironmentAdjustments | null;
}

/**
 * The whole composite in `tonemap.glsl`'s order: exposure, glow gather and blend, tone curve, then
 * the adjustments. Godot exposes the scene once before the blend (`color.rgb *= exposure`), and the
 * bright pass already exposed the glow, so the curve runs at exposure 1.0. A null `glow` clears
 * `FLAG_USE_GLOW`, and a null `adjustments` clears `FLAG_USE_BCS`.
 */
export function compositeGlsl({ glow, toneMapping, adjustments }: CompositeOptions): string {
  return /* glsl */ `
uniform float godotExposure;
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
${glow ? glowDefinitionsGlsl(glow, toneMapping) : ''}
${adjustments ? GODOT_TO_SRGB_GLSL + GODOT_TO_LINEAR_GLSL : ''}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
${glow ? glowAndToneMapGlsl(glow) : TONE_MAP_ONLY_GLSL}
${adjustments ? adjustmentsGlsl(adjustments) : ''}
  outputColor = vec4(color, inputColor.a);
}
`;
}

/**
 * SCREEN normalises against the floored white, not the authored one
 * (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`).
 * Godot's comment in `apply_glow`: "white cannot be smaller than the maximum output value".
 */
function glowDefinitionsGlsl(glow: GlowParams, toneMapping: CompositeToneMapping): string {
  return /* glsl */ `
uniform sampler2D godotGlowBuffer;
${blendGlsl(glow, resolvedWhite(toneMapping.mode, toneMapping.white))}`;
}

/** `tonemap.glsl:869-914`: SOFTLIGHT blends after the curve, with the glow tonemapped too. */
function glowAndToneMapGlsl(glow: GlowParams): string {
  const blend = blendsAfterToneMapping(glow)
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0);
  color = godotGlowBlend(color, godotToneMap(glow, 1.0));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0) * godotExposure, glow);
  color = godotToneMap(color, 1.0);`;
  return /* glsl */ `  vec3 glow = texture2D(godotGlowBuffer, uv).rgb * ${glslFloat(glow.intensity)};
${blend}`;
}

/** `tonemap.glsl:859-899` with `FLAG_USE_GLOW` clear: exposure, then the curve. */
const TONE_MAP_ONLY_GLSL = /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0);`;

/**
 * `tonemap.glsl:916-946`: brightness on linear values, contrast and an equal-weight saturation on
 * sRGB values, then back to linear, because the composer encodes the output as Godot's sRGB
 * framebuffer does.
 */
function adjustmentsGlsl({ brightness, contrast, saturation }: EnvironmentAdjustments): string {
  return /* glsl */ `  color *= ${glslFloat(brightness)};
  color = godotToSrgb(color);
  color = mix(vec3(0.5), color, ${glslFloat(contrast)});
  color = mix(vec3(dot(vec3(1.0), color) / 3.0), color, ${glslFloat(saturation)});
  color = godotToLinear(color);`;
}
