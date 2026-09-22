/**
 * Godot's `tonemap.glsl` `main()` — the pass that assembles a glow blend and a tone
 * curve into one fragment shader.
 *
 * Its own module because it is neither of the two things it composes. `godotGlow.ts`
 * describes Godot's glow and `godotToneMapping.ts` its tone curves; putting the
 * assembly in either would make that one import the other, and then nothing could
 * ask "does this environment glow?" without pulling in all five tone-curve bodies.
 * The arrow cannot be reversed either: the in-material tonemap path already imports
 * the curves and has no business acquiring glow.
 *
 * Ported from Godot 4.6's `servers/rendering/renderer_rd/shaders/effects/tonemap.glsl`,
 * used under the MIT licence — see THIRD-PARTY-NOTICES.md.
 */

import { blendGlsl, blendsAfterToneMapping, type GlowParams } from './godotGlow';
import { glslFloat } from './glslLiterals';
import { resolvedWhite, toneMappingEffectGlsl } from './godotToneMapping';

/**
 * The whole composite, in `tonemap.glsl`'s order — the glow gather, the blend, and
 * the tone curve in one shader, which is how Godot ships it.
 *
 * Exposure is the subtle part. Godot applies it to the SCENE colour once, before
 * the blend (`color.rgb *= exposure` near the top of `main()`), while the GLOW
 * buffer was already exposed by the bright pass. So the tone curve here is invoked
 * with an exposure of 1.0: it is the curve alone, and each operand has been exposed
 * exactly once. Multiplying by exposure again would double it on the glow and, on
 * the pre-tonemap path, scale the blended sum instead of its operands.
 *
 * A null `params` is the same shader with `FLAG_USE_GLOW` clear.
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

  // SCREEN normalises against Godot's `params.white`, which the renderer fills
  // from `environment_get_white` — the FLOORED white, not the authored property
  // (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`).
  // Godot's own comment on the clamp inside `apply_glow` says as much: "white
  // cannot be smaller than the maximum output value".
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
