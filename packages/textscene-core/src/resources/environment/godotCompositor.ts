/**
 * Godot's `tonemap.glsl` `main()`: one fragment shader from a glow blend, a tone curve and the
 * colour adjustments. Its own module, so asking "does this environment glow?" pulls in no tone
 * curve, and the in-material tonemap path pulls in no glow.
 */

/*
 * Ported from Godot 4.6's `servers/rendering/renderer_rd/shaders/effects/tonemap.glsl`,
 * used under the MIT licence: see THIRD-PARTY-NOTICES.md.
 */

import { blendGlsl, blendsAfterToneMapping, samplesGlowMap, type GlowParams } from './godotGlow';
import { glslFloat } from '../../utils/glslLiterals';
import { toneMappingEffectGlsl } from './godotToneMapping';
import { resolvedWhite } from '../../godot/rendering/environment/toneMapping.js';
import type { EnvironmentAdjustments, EnvironmentSettings } from './types';
import { GODOT_TO_LINEAR_GLSL, GODOT_TO_SRGB_GLSL } from '../../godot/rendering/srgbTransfer';

export type CompositeToneMapping = Pick<EnvironmentSettings['toneMapping'], 'mode' | 'white'> &
  Partial<Pick<EnvironmentSettings['toneMapping'], 'agxContrast'>>;

/** The effect binds the glow buffer each frame and the glow map on request; exposure is fixed at construction. */
const EXPOSURE_UNIFORM = 'godotExposure';
export const GLOW_BUFFER_UNIFORM = 'godotGlowBuffer';
export const GLOW_MAP_UNIFORM = 'godotGlowMap';

/** One field per `tonemap.glsl` flag group. A null clears that flag. */
export interface CompositeOptions {
  /** Null when the environment has no glow: `FLAG_USE_GLOW` clear. */
  glow: GlowParams | null;
  toneMapping: CompositeToneMapping;
  /** Null when `adjustment_enabled` is false: `FLAG_USE_BCS` clear. */
  adjustments: EnvironmentAdjustments | null;
  /** Godot `tonemap_exposure`, the starting value of the exposure uniform. */
  exposure: number;
}

interface UniformDeclaration {
  glslType: 'float' | 'sampler2D';
  value: number | null;
}

/**
 * The composite shader with the uniforms it declares. A number is the uniform's value; null is a
 * texture the caller binds. A name is in the map exactly when the shader declares it.
 */
export interface CompositeProgram {
  fragmentShader: string;
  uniforms: Record<string, number | null>;
}

/**
 * The whole composite in `tonemap.glsl`'s order: exposure, glow gather and blend, tone curve, then
 * the adjustments. Godot exposes the scene once before the blend (`color.rgb *= exposure`), and the
 * bright pass already exposed the glow, so the curve runs at exposure 1.0. A null `glow` clears
 * `FLAG_USE_GLOW`, and a null `adjustments` clears `FLAG_USE_BCS`.
 */
export function compositeProgram({
  glow,
  toneMapping,
  adjustments,
  exposure,
}: CompositeOptions): CompositeProgram {
  const declarations: Record<string, UniformDeclaration> = {
    [EXPOSURE_UNIFORM]: { glslType: 'float', value: exposure },
    ...(glow && { [GLOW_BUFFER_UNIFORM]: { glslType: 'sampler2D', value: null } }),
    ...(glow && samplesGlowMap(glow) && { [GLOW_MAP_UNIFORM]: { glslType: 'sampler2D', value: null } }),
  };
  const fragmentShader = /* glsl */ `
${declarationsGlsl(declarations)}
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
${glow ? glowDefinitionsGlsl(glow, toneMapping) : ''}
${adjustments ? GODOT_TO_SRGB_GLSL + GODOT_TO_LINEAR_GLSL : ''}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
${glow ? glowAndToneMapGlsl(glow) : TONE_MAP_ONLY_GLSL}
${adjustments ? adjustmentsGlsl(adjustments) : ''}
  outputColor = vec4(color, inputColor.a);
}
`;
  return {
    fragmentShader,
    uniforms: Object.fromEntries(Object.entries(declarations).map(([name, { value }]) => [name, value])),
  };
}

/** One `uniform` line per declaration, so the shader and the uniform map come from one list. */
function declarationsGlsl(declarations: Record<string, UniformDeclaration>): string {
  return Object.entries(declarations)
    .map(([name, { glslType }]) => `uniform ${glslType} ${name};`)
    .join('\n');
}

/**
 * SCREEN normalises against the floored white, not the authored one
 * (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`).
 * Godot's comment in `apply_glow`: "white cannot be smaller than the maximum output value".
 */
function glowDefinitionsGlsl(glow: GlowParams, toneMapping: CompositeToneMapping): string {
  return /* glsl */ `
${blendGlsl(glow, resolvedWhite(toneMapping.mode, toneMapping.white))}`;
}

/**
 * `tonemap.glsl:869-914`: SOFTLIGHT blends after the curve, with the glow tonemapped too. Both
 * arms scale the glow by the map first (`:886`, `:908`).
 */
function glowAndToneMapGlsl(glow: GlowParams): string {
  const blend = blendsAfterToneMapping(glow)
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM}, 1.0);
  color = godotGlowBlend(color, godotToneMap(glow, 1.0));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM}, glow);
  color = godotToneMap(color, 1.0);`;
  const map = samplesGlowMap(glow)
    ? /* glsl */ `  glow = mix(glow, texture2D(${GLOW_MAP_UNIFORM}, uv).rgb * glow, ${glslFloat(glow.mapStrength)});\n`
    : '';
  return /* glsl */ `  vec3 glow = texture2D(${GLOW_BUFFER_UNIFORM}, uv).rgb * ${glslFloat(glow.intensity)};
${map}${blend}`;
}

/** `tonemap.glsl:859-899` with `FLAG_USE_GLOW` clear: exposure, then the curve. */
const TONE_MAP_ONLY_GLSL = /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM}, 1.0);`;

/**
 * `tonemap.glsl:916-946`: brightness on linear values, contrast and an equal-weight saturation on
 * sRGB values, then back to linear, because the composer encodes the output as Godot's sRGB
 * framebuffer does. The decode clamps at 0, as Godot's 8-bit store does: three's encode takes
 * `pow` of the value, and GLSL leaves `pow` of a negative undefined.
 */
function adjustmentsGlsl({ brightness, contrast, saturation }: EnvironmentAdjustments): string {
  return /* glsl */ `  color *= ${glslFloat(brightness)};
  color = godotToSrgb(color);
  color = mix(vec3(0.5), color, ${glslFloat(contrast)});
  color = mix(vec3(dot(vec3(1.0), color) / 3.0), color, ${glslFloat(saturation)});
  color = godotToLinear(max(color, vec3(0.0)));`;
}
