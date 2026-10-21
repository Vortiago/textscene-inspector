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
import { glowGatherGlsl, glowLevelUniform } from './godotGlowPyramid';
import { glslFloat } from '../../utils/glslLiterals';
import { toneMappingEffectGlsl } from './godotToneMapping';
import { resolvedWhite } from '../../godot/rendering/environment/toneMapping.js';
import type { EnvironmentAdjustments, EnvironmentSettings } from './types';
import { GODOT_TO_LINEAR_GLSL, GODOT_TO_SRGB_GLSL } from '../../godot/rendering/srgbTransfer';

export type CompositeToneMapping = Pick<EnvironmentSettings['toneMapping'], 'mode' | 'white'> &
  Partial<Pick<EnvironmentSettings['toneMapping'], 'agxContrast'>>;

/** Fixed at construction: a new exposure rebuilds the effect. */
const EXPOSURE_UNIFORM = 'godotExposure';
/** Bound by the effect when the environment names a glow map. */
export const GLOW_MAP_UNIFORM = 'godotGlowMap';

/** One field per `tonemap.glsl` flag group. A null clears that flag. */
export interface CompositeOptions {
  /** Null when the environment has no glow: `FLAG_USE_GLOW` clear. */
  glow: GlowParams | null;
  toneMapping: CompositeToneMapping;
  /** Null when `adjustment_enabled` is false: `FLAG_USE_BCS` clear. */
  adjustments: EnvironmentAdjustments | null;
  /**
   * `rendering/viewport/transparent_background`. `tonemap.glsl` writes the buffer's alpha through,
   * and only a transparent window shows it: the screen blit copies it with blending off
   * (`renderer_compositor_rd.cpp:138`) into an opaque surface.
   */
  transparentBackground: boolean;
  /**
   * `rendering/environment/glow/upscale_mode` is above Linear: the gather reads each level with the
   * cubic B-spline rather than one bilinear fetch (`renderer_scene_render_rd.cpp:1717`).
   */
  usesBicubicGlowUpscale: boolean;
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
  transparentBackground,
  usesBicubicGlowUpscale,
}: CompositeOptions): CompositeProgram {
  const declarations: Record<string, UniformDeclaration> = {
    [EXPOSURE_UNIFORM]: { glslType: 'float', value: exposure },
    ...Object.fromEntries(
      (glow?.gatheredLevels ?? []).map((level) => [
        glowLevelUniform(level),
        { glslType: 'sampler2D', value: null } satisfies UniformDeclaration,
      ])
    ),
    ...(glow && samplesGlowMap(glow) && { [GLOW_MAP_UNIFORM]: { glslType: 'sampler2D', value: null } }),
  };
  // SCREEN normalises against the floored white, not the authored one
  // (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`): Godot's
  // `apply_glow` says "white cannot be smaller than the maximum output value".
  const flooredWhite = resolvedWhite(toneMapping.mode, toneMapping.white);
  const fragmentShader = /* glsl */ `
${declarationsGlsl(declarations)}
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
${glow ? glowGatherGlsl(glow, usesBicubicGlowUpscale) + blendGlsl(glow, flooredWhite) : ''}
${adjustments ? GODOT_TO_SRGB_GLSL + GODOT_TO_LINEAR_GLSL : ''}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
${glow ? glowAndToneMapGlsl(glow) : TONE_MAP_ONLY_GLSL}
${adjustments ? adjustmentsGlsl(adjustments) : ''}
  outputColor = vec4(color, ${transparentBackground ? 'inputColor.a' : '1.0'});
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
 * `tonemap.glsl:869-914`: SOFTLIGHT blends after the curve, with the glow tonemapped too. Both
 * arms scale the glow by the map first (`:886`, `:908`).
 */
function glowAndToneMapGlsl(glow: GlowParams): string {
  const blend = blendsAfterToneMapping(glow)
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM});
  color = godotGlowBlend(color, godotToneMap(glow));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM}, glow);
  color = godotToneMap(color);`;
  const map = samplesGlowMap(glow)
    ? /* glsl */ `  glow = mix(glow, texture2D(${GLOW_MAP_UNIFORM}, uv).rgb * glow, ${glslFloat(glow.mapStrength)});\n`
    : '';
  return /* glsl */ `  vec3 glow = godotGlowGather(uv) * ${glslFloat(glow.intensity)};
${map}${blend}`;
}

/** `tonemap.glsl:859-899` with `FLAG_USE_GLOW` clear: exposure, then the curve. */
const TONE_MAP_ONLY_GLSL = /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * ${EXPOSURE_UNIFORM});`;

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
