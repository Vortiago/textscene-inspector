/**
 * The GLSL of Godot's glow pyramid: the gaussian passes that build each level, and the gather that
 * the composite reads them through. Ported from Godot 4.6's
 * `servers/rendering/renderer_rd/shaders/effects/{copy,tonemap}.glsl`, used under the MIT licence
 * (see THIRD-PARTY-NOTICES.md). The uniform names below are the contract with the effect that
 * draws the passes.
 */

import { brightPassGlsl, type GlowParams } from './godotGlow';
import { bicubicFilterGlsl } from '../../utils/bicubicFilterGlsl';
import { glslFloat } from '../../utils/glslLiterals';

/** The texture a blur pass reads: the frame for level 0, the level before it for the rest. */
export const BLUR_SOURCE_UNIFORM = 'sourceBuffer';
/** The horizontal pass's result, which the vertical pass reads. */
export const BLUR_BLURRED_UNIFORM = 'blurredBuffer';
/**
 * The size of the glow texture, which is level 0, in pixels. The bicubic read takes the size of a
 * level from it, as `glow_texture_size >> lod` does (`tonemap.glsl:339`).
 */
export const GLOW_TEXTURE_SIZE_UNIFORM = 'godotGlowTextureSize';

/** The composite's sampler for one built level. */
export function glowLevelUniform(level: number): string {
  return `godotGlowLevel${level}`;
}

/**
 * The five weights of `MODE_GLOW`'s gaussian (`copy.glsl:116`): the centre, then each step out.
 * They sum to one over the nine taps. Godot's plain blur has its own, narrower four.
 */
const KERNEL = [0.2024, 0.179, 0.124, 0.0672, 0.0285];

const BLUR_HEADER = /* glsl */ `
const float kernel[5] = float[5](${KERNEL.map(glslFloat).join(', ')});

// Godot loads the source 2x2 pixels at a time, clamping the even pixel of a pair into
// [0, size - 2] and reading its odd partner one on (copy.glsl:99-105). Past an edge the
// taps therefore alternate between the two outermost pixels, where a plain clamp repeats one.
int godotGlowEdge(int pixel, int size) {
  return clamp(pixel - (pixel & 1), 0, max(size - 2, 0)) + (pixel & 1);
}
`;

/** Godot's own luma weights for the firefly tonemap (`copy.glsl:110`). */
const FIREFLY_LUMA_WEIGHTS = 'vec3(0.299, 0.587, 0.114)';

/**
 * The tonemap that keeps one firefly from owning the first level: each source sample is divided
 * by `1 + luma / max(cap, 6)` before the blur and the blur is multiplied back after
 * (`copy.glsl:108-114`, `:183-185`). `max(cap, 6)` stops a small cap from weighting too hard.
 */
function fireflyLumaGlsl(params: GlowParams): string {
  return `${FIREFLY_LUMA_WEIGHTS} / ${glslFloat(Math.max(params.luminanceCap, 6))}`;
}

/** One horizontal pass: nine taps, each a bilinear read at its pixel's centre, so 2x2 is a box. */
function horizontalGlsl(weighSample: (color: string) => string): string {
  return /* glsl */ `
uniform sampler2D ${BLUR_SOURCE_UNIFORM};
${BLUR_HEADER}
// The row is the one this pass writes. The vertical pass maps nominal rows to these rows, and a
// row mapped here as well would be mapped twice.
vec3 loadSource(ivec2 pixel) {
  ivec2 size = max(textureSize(${BLUR_SOURCE_UNIFORM}, 0) / 2, ivec2(1));
  ivec2 edge = ivec2(godotGlowEdge(pixel.x, size.x), pixel.y);
  vec3 color = texture2D(${BLUR_SOURCE_UNIFORM}, (vec2(edge) + 0.5) / vec2(size)).rgb;
  return ${weighSample('color')};
}

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  vec3 sum = loadSource(pixel) * kernel[0];
  for (int tap = 1; tap <= 4; tap++) {
    sum += (loadSource(pixel + ivec2(tap, 0)) + loadSource(pixel - ivec2(tap, 0))) * kernel[tap];
  }
  gl_FragColor = vec4(sum, 1.0);
}
`;
}

/** One vertical pass over the horizontal result, then `finish` on the blurred colour. */
function verticalGlsl(finish: string): string {
  return /* glsl */ `
uniform sampler2D ${BLUR_BLURRED_UNIFORM};
${BLUR_HEADER}
// Godot counts rows from the top of the image and a framebuffer from the bottom, so the
// pair rule runs on the mirrored row. A one-row level has no partner row, so the clamp keeps
// the rule's odd result inside the texture, where texelFetch is undefined.
int godotGlowRowEdge(int row, int rows) {
  return clamp(rows - 1 - godotGlowEdge(rows - 1 - row, rows), 0, rows - 1);
}

vec3 blurredAt(ivec2 pixel, int offset) {
  int rows = textureSize(${BLUR_BLURRED_UNIFORM}, 0).y;
  return texelFetch(${BLUR_BLURRED_UNIFORM}, ivec2(pixel.x, godotGlowRowEdge(pixel.y + offset, rows)), 0).rgb;
}

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  vec3 color = blurredAt(pixel, 0) * kernel[0];
  for (int tap = 1; tap <= 4; tap++) {
    color += (blurredAt(pixel, tap) + blurredAt(pixel, -tap)) * kernel[tap];
  }
${finish}
  gl_FragColor = vec4(color, 1.0);
}
`;
}

/** The two passes that blur one level. */
export interface LevelBlurGlsl {
  horizontal: string;
  vertical: string;
}

/**
 * Level 0's blur: the horizontal pass weighs each frame sample against fireflies, and the vertical
 * pass undoes the weight, then runs the bright pass.
 */
export function firstLevelBlurGlsl(params: GlowParams): LevelBlurGlsl {
  return {
    horizontal: horizontalGlsl((color) => `${color} / (1.0 + dot(${color}, ${fireflyLumaGlsl(params)}))`),
    vertical: `${brightPassGlsl(params)}${verticalGlsl(
      `  color = color / (1.0 - dot(color, ${fireflyLumaGlsl(params)}));\n  color = godotGlowBrightPass(color);`
    )}`,
  };
}

/** The blur of every later level: a plain blur of the level before, then `glow_strength`. */
export function laterLevelBlurGlsl(params: GlowParams): LevelBlurGlsl {
  return {
    horizontal: horizontalGlsl((color) => color),
    vertical: verticalGlsl(`  color *= ${glslFloat(params.strength)};`),
  };
}

/**
 * The cubic B-spline read the composite takes of each level (`tonemap.glsl:271-338`), Godot's
 * default `rendering/environment/glow/upscale_mode`: four bilinear fetches stand in for sixteen
 * texels. The size is `glow_texture_size >> lod`, which for a level the frame has no mip for is the
 * size of the missing level, read from the last mip. A size under 1px clamps to 1px, where Godot
 * divides by zero.
 */
const BICUBIC_GLSL = bicubicFilterGlsl({
  prefix: 'godotGlow',
  params: 'sampler2D tex, vec2 uv, int lod',
  uv: 'uv',
  size: `max(vec2(ivec2(${GLOW_TEXTURE_SIZE_UNIFORM}) >> lod), vec2(1.0))`,
  fetch: (texelUv) => `texture2D(tex, ${texelUv}).rgb`,
});

/**
 * Godot's `gather_glow` (`tonemap.glsl:376-410`): the sum of each gathered level at its weight,
 * read at one uv. The read is the cubic B-spline, or a bilinear fetch under the Linear upscale mode
 * (`:366-374`). Declares `godotGlowGather(uv)`; the caller declares the level samplers.
 */
export function glowGatherGlsl(params: GlowParams, usesBicubicGlowUpscale: boolean): string {
  const read = (level: number) => {
    const sampler = glowLevelUniform(level);
    return usesBicubicGlowUpscale
      ? `godotGlowBicubic(${sampler}, uv, ${level})`
      : `texture2D(${sampler}, uv).rgb`;
  };
  const terms = params.gatheredLevels.map(
    (level) => `  glow += ${read(level)} * ${glslFloat(params.levels[level]!)};`
  );
  return /* glsl */ `${usesBicubicGlowUpscale ? BICUBIC_GLSL : ''}
vec3 godotGlowGather(vec2 uv) {
  vec3 glow = vec3(0.0);
${terms.join('\n')}
  return glow;
}
`;
}
