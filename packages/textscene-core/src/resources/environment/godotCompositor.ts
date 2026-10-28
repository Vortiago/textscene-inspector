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
import { GLOW_TEXTURE_SIZE_UNIFORM, glowGatherGlsl, glowLevelUniform } from './godotGlowPyramid';
import { glslFloat } from '../../utils/glslLiterals';
import { toneMappingEffectGlsl } from './godotToneMapping';
import {
  AUTO_EXPOSURE_GAIN_GLSL,
  AUTO_EXPOSURE_SCALE_UNIFORM,
  LUMINANCE_UNIFORM,
  NO_AUTO_EXPOSURE_GAIN_GLSL,
} from './godotLuminance';
import type { AutoExposure } from '../cameraattributes/types';
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
  /** Null when the camera attributes hold no auto exposure: `FLAG_USE_AUTO_EXPOSURE` clear. */
  autoExposure: AutoExposure | null;
  /** Godot `tonemap_exposure`, the starting value of the exposure uniform. */
  exposure: number;
  /**
   * The viewport's `use_debanding`: `FLAG_USE_8_BIT_DEBANDING`, since every target here stores
   * 8-bit values (`renderer_scene_render_rd.cpp:784-797`).
   */
  usesDebanding: boolean;
}

interface UniformDeclaration {
  glslType: 'float' | 'vec2' | 'sampler2D';
  value: number | null;
}

/**
 * The composite shader with the uniforms it declares. A number is the uniform's value; null is a
 * texture or a vector the caller binds. A name is in the map exactly when the shader declares it.
 */
export interface CompositeProgram {
  fragmentShader: string;
  uniforms: Record<string, number | null>;
}

/**
 * The whole composite in `tonemap.glsl`'s order: exposure, glow gather and blend, tone curve, then
 * the adjustments. Godot exposes the scene once before the blend (`color.rgb *= exposure`), and the
 * bright pass already exposed the glow, so the curve runs at exposure 1.0. A null `glow` clears
 * `FLAG_USE_GLOW`, a null `adjustments` clears `FLAG_USE_BCS` and a null `autoExposure` clears
 * `FLAG_USE_AUTO_EXPOSURE`.
 */
export function compositeProgram({
  glow,
  toneMapping,
  adjustments,
  autoExposure,
  exposure,
  transparentBackground,
  usesBicubicGlowUpscale,
  usesDebanding,
}: CompositeOptions): CompositeProgram {
  const declarations: Record<string, UniformDeclaration> = {
    [EXPOSURE_UNIFORM]: { glslType: 'float', value: exposure },
    ...(autoExposure && {
      [LUMINANCE_UNIFORM]: { glslType: 'sampler2D', value: null },
      [AUTO_EXPOSURE_SCALE_UNIFORM]: { glslType: 'float', value: autoExposure.scale },
    }),
    ...Object.fromEntries(
      (glow?.gatheredLevels ?? []).map((level) => [
        glowLevelUniform(level),
        { glslType: 'sampler2D', value: null } satisfies UniformDeclaration,
      ])
    ),
    ...(glow && usesBicubicGlowUpscale && { [GLOW_TEXTURE_SIZE_UNIFORM]: { glslType: 'vec2', value: null } }),
    ...(glow && samplesGlowMap(glow) && { [GLOW_MAP_UNIFORM]: { glslType: 'sampler2D', value: null } }),
  };
  // SCREEN normalises against the floored white, not the authored one
  // (`renderer_scene_render_rd.cpp`: `tonemap.white = environment_get_white(...)`): Godot's
  // `apply_glow` says "white cannot be smaller than the maximum output value".
  const flooredWhite = resolvedWhite(toneMapping.mode, toneMapping.white);
  const fragmentShader = /* glsl */ `
${declarationsGlsl(declarations)}
${autoExposure ? AUTO_EXPOSURE_GAIN_GLSL : NO_AUTO_EXPOSURE_GAIN_GLSL}
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white, toneMapping.agxContrast)}
${glow ? glowGatherGlsl(glow, usesBicubicGlowUpscale) + blendGlsl(glow, flooredWhite) : ''}
${adjustments || usesDebanding ? GODOT_TO_SRGB_GLSL + GODOT_TO_LINEAR_GLSL : ''}
${usesDebanding ? DITHER_GLSL : ''}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
${FRAME_EXPOSURE_GLSL}
${glow ? glowAndToneMapGlsl(glow) : TONE_MAP_ONLY_GLSL}
${adjustments ? adjustmentsGlsl(adjustments) : ''}
${usesDebanding ? DEBANDING_GLSL : ''}
  outputColor = vec4(color, ${transparentBackground ? 'inputColor.a' : '1.0'});
}
`;
  return {
    fragmentShader,
    uniforms: Object.fromEntries(Object.entries(declarations).map(([name, { value }]) => [name, value])),
  };
}

/**
 * The exposure of one frame: the tonemap's own, times the gain of the auto exposure, which is 1
 * without one (`tonemap.glsl:869-873`).
 */
const FRAME_EXPOSURE = 'godotFrameExposure';
const FRAME_EXPOSURE_GLSL = `  float ${FRAME_EXPOSURE} = ${EXPOSURE_UNIFORM} * godotAutoExposureGain();`;

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
    ? /* glsl */ `  vec3 color = godotToneMap(inputColor.rgb * ${FRAME_EXPOSURE});
  color = godotGlowBlend(color, godotToneMap(glow));`
    : /* glsl */ `  vec3 color = godotGlowBlend(inputColor.rgb * ${FRAME_EXPOSURE}, glow);
  color = godotToneMap(color);`;
  const map = samplesGlowMap(glow)
    ? /* glsl */ `  glow = mix(glow, texture2D(${GLOW_MAP_UNIFORM}, uv).rgb * glow, ${glslFloat(glow.mapStrength)});\n`
    : '';
  return /* glsl */ `  vec3 glow = godotGlowGather(uv) * ${glslFloat(glow.intensity)};
${map}${blend}`;
}

/**
 * `tonemap.glsl:859-899` with `FLAG_USE_GLOW` clear: exposure, then the curve. Nothing clamps the
 * scene colour before the blend: every curve but LINEAR clamps for itself (`:258`).
 */
const TONE_MAP_ONLY_GLSL = /* glsl */ `  vec3 color = godotToneMap(inputColor.rgb * ${FRAME_EXPOSURE});`;

/**
 * Godot's `screen_space_dither` (`tonemap.glsl:848-856`), one channel at a time: `coord` is the
 * dot product of (171, 231) and the fragment centre, and each channel has its own period. The
 * result spans one 8-bit level, centred on zero.
 */
const DITHER_GLSL = /* glsl */ `
float godotDither(float coord, float period) {
  return (fract(coord / period) - 0.5) / 255.0;
}

vec3 godotDither3(vec2 fragCoord) {
  float coord = dot(vec2(171.0, 231.0), fragCoord);
  return vec3(godotDither(coord, 103.0), godotDither(coord, 71.0), godotDither(coord, 97.0));
}
`;

/**
 * `tonemap.glsl:950-957`: the dither lands on the sRGB value just before the 8-bit store. The
 * fragment counts from the top-left corner, as in Godot. The colour goes back to linear for the
 * composer's encode, clamped at 0 as the 8-bit store clamps, since three's encode takes `pow`.
 */
const DEBANDING_GLSL = /* glsl */ `  vec2 godotFragCoord = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  color = godotToLinear(max(godotToSrgb(color) + godotDither3(godotFragCoord), vec3(0.0)));`;

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
