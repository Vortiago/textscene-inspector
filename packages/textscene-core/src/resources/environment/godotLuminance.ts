/**
 * Godot's auto exposure luminance: the reduction of the HDR frame to one value, and the gain the
 * tonemap and the glow's bright pass divide the exposure by. The GLSL is a fragment form of
 * `luminance_reduce.glsl`, which reduces in compute workgroups. A still frame is the settled one: the
 * adaptation `prev + (average - prev) * speed` stops at the average, so the last level only holds the
 * average between the bounds and the speed has no part (`luminance_reduce.glsl:78`).
 */

/*
 * Ported from Godot 4.6's `servers/rendering/renderer_rd/shaders/effects/luminance_reduce.glsl`,
 * `tonemap.glsl` and `copy.glsl`, used under the MIT licence: see THIRD-PARTY-NOTICES.md.
 */

/** The texels a level of the reduction averages in each axis (`luminance_reduce.glsl:7`). */
const LUMINANCE_BLOCK = 8;

/** The reduction's source: the frame for the first level, the level before it for the rest. */
export const LUMINANCE_SOURCE_UNIFORM = 'godotLuminanceSource';
/** The lower and upper bound of the last level (`luminance_reduce.glsl:78`). */
export const LUMINANCE_MIN_UNIFORM = 'godotLuminanceMin';
export const LUMINANCE_MAX_UNIFORM = 'godotLuminanceMax';
/** The one-texel result, which the tonemap and the glow's bright pass sample. */
export const LUMINANCE_UNIFORM = 'godotLuminance';
/** `auto_exposure_scale`, the luminance that draws as the frame's own colours. */
export const AUTO_EXPOSURE_SCALE_UNIFORM = 'godotAutoExposureScale';

interface LuminanceLevelSize {
  width: number;
  height: number;
}

/**
 * The size of each level of the reduction, down to one texel (`luminance.cpp:85-125`). A size
 * floors at one texel, and the floor drops the texels past the last whole block, which Godot's
 * dispatch writes outside the level.
 */
export function luminanceChainSizes(width: number, height: number): LuminanceLevelSize[] {
  const sizes: LuminanceLevelSize[] = [];
  let level = { width, height };
  do {
    level = {
      width: Math.max(Math.floor(level.width / LUMINANCE_BLOCK), 1),
      height: Math.max(Math.floor(level.height / LUMINANCE_BLOCK), 1),
    };
    sizes.push(level);
  } while (level.width !== 1 || level.height !== 1);
  return sizes;
}

export interface LuminanceLevel {
  /** The first level reads the frame's largest channel. The rest read the red channel of a level. */
  readsFrame: boolean;
  /** The last level holds its average between the bounds. */
  clamps: boolean;
}

/**
 * One level of the reduction: each texel averages the block of the source it covers. A block at the
 * edge averages the texels the source holds (`luminance_reduce.glsl:72-73`). The frame's rows run
 * bottom up in WebGL and top down in Godot, and the last level reads only its first block, so the
 * first level reads the frame from its top row and every level after keeps Godot's order.
 */
export function luminanceReduceGlsl({ readsFrame, clamps }: LuminanceLevel): string {
  const texelAt = readsFrame ? 'ivec2(position.x, sourceSize.y - 1 - position.y)' : 'position';
  return /* glsl */ `
uniform sampler2D ${LUMINANCE_SOURCE_UNIFORM};
${clamps ? `uniform float ${LUMINANCE_MIN_UNIFORM};\nuniform float ${LUMINANCE_MAX_UNIFORM};` : ''}

void main() {
  ivec2 sourceSize = textureSize(${LUMINANCE_SOURCE_UNIFORM}, 0);
  ivec2 origin = ivec2(gl_FragCoord.xy) * ${LUMINANCE_BLOCK};
  ivec2 extent = min(sourceSize - origin, ivec2(${LUMINANCE_BLOCK}));
  float sum = 0.0;
  for (int y = 0; y < ${LUMINANCE_BLOCK}; y++) {
    for (int x = 0; x < ${LUMINANCE_BLOCK}; x++) {
      if (x < extent.x && y < extent.y) {
        ivec2 position = origin + ivec2(x, y);
        vec3 texel = texelFetch(${LUMINANCE_SOURCE_UNIFORM}, ${texelAt}, 0).rgb;
        ${readsFrame ? 'sum += max(texel.r, max(texel.g, texel.b));' : 'sum += texel.r;'}
      }
    }
  }
  float average = sum / float(extent.x * extent.y);
${clamps ? `  average = min(max(average, ${LUMINANCE_MIN_UNIFORM}), ${LUMINANCE_MAX_UNIFORM});` : ''}
  gl_FragColor = vec4(average, 0.0, 0.0, 1.0);
}
`;
}

/** The uniforms of `godotAutoExposureGain`, for a shader that does not list its uniforms elsewhere. */
export const AUTO_EXPOSURE_UNIFORMS_GLSL = /* glsl */ `
uniform sampler2D ${LUMINANCE_UNIFORM};
uniform float ${AUTO_EXPOSURE_SCALE_UNIFORM};
`;

/**
 * `godotAutoExposureGain()`: what the exposure multiplies by, the scale over the luminance
 * (`tonemap.glsl:871-873`, `copy.glsl:193`). The luminance floors at 1e-20, so the gain times an
 * exposure stays finite and a black frame stays black, where `0 * inf` would be NaN.
 */
export const AUTO_EXPOSURE_GAIN_GLSL = /* glsl */ `
float godotAutoExposureGain() {
  float luminance = max(texelFetch(${LUMINANCE_UNIFORM}, ivec2(0), 0).r, 1.0e-20);
  return ${AUTO_EXPOSURE_SCALE_UNIFORM} / luminance;
}
`;

/** `godotAutoExposureGain()` without an auto exposure: the exposure keeps its own value. */
export const NO_AUTO_EXPOSURE_GAIN_GLSL = /* glsl */ `
float godotAutoExposureGain() {
  return 1.0;
}
`;
