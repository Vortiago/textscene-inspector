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

/**
 * The whole composite in `tonemap.glsl`'s order: glow gather, blend and tone curve.
 * Godot exposes the scene once before the blend (`color.rgb *= exposure`), and the
 * bright pass already exposed the glow, so the curve runs at exposure 1.0. A null
 * `params` is the same shader with `FLAG_USE_GLOW` clear.
 */
export function compositeGlsl(
  params: GlowParams | null,
  toneMapping: { mode: number; white: number; agxContrast?: number }
): string {
  if (!params) return toneMapOnlyGlsl(toneMapping);

  const blend = blendsAfterToneMapping(params)
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0);
  color = godotGlowBlend(color, godotToneMap(glow, 1.0));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0) * godotExposure, glow);
  color = godotToneMap(color, 1.0);`;

  // SCREEN normalises against `params.white`, the floored white, not the authored one
  // (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`).
  // Godot's comment in `apply_glow`: "white cannot be smaller than the maximum output value".
  return /* glsl */ `
uniform sampler2D godotGlowBuffer;
uniform float godotExposure;
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
${blendGlsl(params, resolvedWhite(toneMapping.mode, toneMapping.white))}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 glow = texture2D(godotGlowBuffer, uv).rgb * ${glslFloat(params.intensity)};
${blend}
  outputColor = vec4(color, inputColor.a);
}
`;
}

/** `tonemap.glsl:859-899` with `FLAG_USE_GLOW` clear: exposure, then the curve. */
function toneMapOnlyGlsl(toneMapping: {
  mode: number;
  white: number;
  agxContrast?: number;
}): string {
  return /* glsl */ `
uniform float godotExposure;
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0);
  outputColor = vec4(color, inputColor.a);
}
`;
}
