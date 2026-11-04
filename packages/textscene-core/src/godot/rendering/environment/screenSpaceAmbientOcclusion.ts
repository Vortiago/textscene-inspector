/**
 * Godot 4.6.3's screen-space ambient occlusion, Intel's ASSAO as Godot ports it: the project
 * settings it reads, the buffers it draws into and the constants its passes read. Paths under
 * `renderer_rd/` are in `servers/rendering/renderer_rd/`.
 */

/** `RS::EnvironmentSSAOQuality`, which `RS::EnvironmentSSILQuality` repeats. */
export const SSAO_QUALITY = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  ULTRA: 4,
} as const;

export type SsaoQuality = (typeof SSAO_QUALITY)[keyof typeof SSAO_QUALITY];

export const SSAO_QUALITIES: readonly SsaoQuality[] = Object.values(SSAO_QUALITY);

/**
 * The project settings that shape the occlusion of every Environment (`ss_effects.cpp:151`). The
 * SSIL pair is there because one depth buffer serves both effects, and its shape follows both
 * (`ss_effects.cpp:520-547`).
 */
export interface SsaoProjectSettings {
  quality: SsaoQuality;
  isHalfSize: boolean;
  /** The share of the flexible taps an Ultra gather spends on average. */
  adaptiveTarget: number;
  blurPasses: number;
  /** The view depth, in metres, at which the occlusion starts to fade out. */
  fadeoutFrom: number;
  /** The view depth, in metres, past which no occlusion is left. */
  fadeoutTo: number;
  ssilQuality: SsaoQuality;
  isSsilHalfSize: boolean;
}

/** Each setting's `GLOBAL_DEF` (`servers/rendering/rendering_server.cpp:3756-3764`). */
export const SSAO_PROJECT_DEFAULTS: SsaoProjectSettings = {
  quality: SSAO_QUALITY.MEDIUM,
  isHalfSize: true,
  adaptiveTarget: 0.5,
  blurPasses: 2,
  fadeoutFrom: 50,
  fadeoutTo: 300,
  ssilQuality: SSAO_QUALITY.MEDIUM,
  isSsilHalfSize: true,
};

interface BufferSize {
  width: number;
  height: number;
}

/**
 * The size of each deinterleaved slice, and of the importance map (`ss_effects.cpp:1104-1114`): a
 * half or a quarter of the frame at full size, a quarter or an eighth at half size, rounded up.
 */
export function ssaoBufferSizes(
  frame: BufferSize,
  isHalfSize: boolean
): { buffer: BufferSize; half: BufferSize } {
  const shift = isHalfSize ? 2 : 1;
  const divided = (side: number, by: number): number => Math.trunc((side + by - 1) / by);
  return {
    buffer: { width: divided(frame.width, 1 << shift), height: divided(frame.height, 1 << shift) },
    half: { width: divided(frame.width, 2 << shift), height: divided(frame.height, 2 << shift) },
  };
}

/**
 * The size of `level` of the linear depth's mips: half the frame, rounded up, at level 0, and each
 * level after it half its parent, rounded down (`ss_effects.cpp:510-515`).
 */
export function ssaoDepthLevelSize(frame: BufferSize, level: number): BufferSize {
  const levelSide = (side: number): number => Math.max(1, Math.trunc((side + 1) / 2) >> level);
  return { width: levelSide(frame.width), height: levelSide(frame.height) };
}

/**
 * How the depth downsample fills the four deinterleaved slices of linear depth: `halfBuffers`
 * writes slices 0 and 3 only, `mips` and `fullMips` also write 3 or 4 levels of smart averages
 * above the base (`ss_effects_downsample.glsl`).
 */
export type SsaoDownsampleMode = 'plain' | 'halfBuffers' | 'mips' | 'fullMips';

export interface SsaoDepthDownsample {
  mode: SsaoDownsampleMode;
  /** `USE_HALF_SIZE`: each slice texel reads every fourth depth texel, not every second. */
  isHalfSize: boolean;
  /** The level the downsample writes its base into (`depth_index`). */
  baseLevel: number;
  /** The levels it writes above the base. */
  mipLevels: number;
  /** The level the gather reads as its own level 0 (`ss_effects.cpp:1212`). */
  gatherLevel: number;
}

/** `SSEffects::downsample_depth`'s choice of shader and levels (`ss_effects.cpp:520-547`). */
export function ssaoDepthDownsample(project: SsaoProjectSettings): SsaoDepthDownsample {
  const { quality, ssilQuality, isHalfSize: isSsaoHalfSize, isSsilHalfSize } = project;
  let usesMips = quality > SSAO_QUALITY.MEDIUM || ssilQuality > SSAO_QUALITY.MEDIUM;
  let mode: SsaoDownsampleMode = 'plain';
  if (quality === SSAO_QUALITY.VERY_LOW && ssilQuality === SSAO_QUALITY.VERY_LOW) mode = 'halfBuffers';
  else if (usesMips) mode = 'mips';
  const isHalfSize = isSsaoHalfSize && isSsilHalfSize;
  if (!isHalfSize && isSsaoHalfSize !== isSsilHalfSize) {
    mode = usesMips ? 'fullMips' : 'mips';
    usesMips = true;
  }
  const mipLevels = !usesMips ? 0 : mode === 'fullMips' ? 4 : 3;
  return { mode, isHalfSize, baseLevel: isHalfSize ? 1 : 0, mipLevels, gatherLevel: isSsaoHalfSize ? 1 : 0 };
}

/** The deinterleaved slices the gather and the blur draw: Very Low skips 1 and 2 (`ss_effects.cpp:1069`). */
export function ssaoGatheredSlices(quality: SsaoQuality): number[] {
  return quality === SSAO_QUALITY.VERY_LOW ? [0, 3] : [0, 1, 2, 3];
}

/** `ssao_blur.glsl`'s modes. */
export type SsaoBlurMode = 'nonSmart' | 'smart' | 'wide';

/**
 * Each blur pass's mode, in order (`ss_effects.cpp:1326-1338`). Very Low blurs once, plainly. Above
 * it the last two passes blur by the edges and any before them blur wide.
 */
export function ssaoBlurModes(quality: SsaoQuality, blurPasses: number): SsaoBlurMode[] {
  if (quality === SSAO_QUALITY.VERY_LOW) return ['nonSmart'];
  return Array.from({ length: Math.max(0, blurPasses) }, (_, pass) =>
    pass < blurPasses - 2 ? 'wide' : 'smart'
  );
}

/**
 * Whether the interleave reads the pong buffer, which an odd blur pass writes, rather than the
 * gathered one (`ss_effects.cpp:1405-1411`).
 */
export function ssaoReadsBlurredFromPong(quality: SsaoQuality, blurPasses: number): boolean {
  return !(quality > SSAO_QUALITY.VERY_LOW && blurPasses % 2 === 0);
}

/** `ssao_interleave.glsl`'s modes. */
export type SsaoInterleaveMode = 'half' | 'nonSmart' | 'smart';

/** The interleave back to the full frame (`ss_effects.cpp:1392-1397`). */
export function ssaoInterleaveMode(quality: SsaoQuality): SsaoInterleaveMode {
  if (quality === SSAO_QUALITY.VERY_LOW) return 'half';
  return quality === SSAO_QUALITY.LOW ? 'nonSmart' : 'smart';
}

/**
 * The 20 rotation-and-scale matrices of the gather's sample disc, four per pass in five sub-passes
 * (`ss_effects.cpp:76-94`), laid out as `SSEffectsGatherConstants.rotation_matrices`.
 */
export const SSAO_ROTATION_MATRICES: readonly number[] = rotationMatrices();

function rotationMatrices(): number[] {
  const subPassCount = 5;
  const subPassOrder = [0, 1, 4, 3, 2];
  const matrices: number[] = [];
  for (let pass = 0; pass < 4; pass++) {
    for (let subPass = 0; subPass < subPassCount; subPass++) {
      const b = subPassOrder[subPass]!;
      const angle = ((pass + b / subPassCount) * Math.PI) / 2;
      const scale = 1 + (pass - 1.5 + (b - (subPassCount - 1) * 0.5) / subPassCount) * 0.07;
      const cos = Math.fround(Math.cos(angle));
      const sin = Math.fround(Math.sin(angle));
      matrices.push(scale * cos, scale * -sin, -scale * sin, -scale * cos);
    }
  }
  return matrices;
}

/** A projection, column-major as Godot's `Projection::columns` and three's `Matrix4.elements`. */
type Projection = ArrayLike<number>;

const column = (projection: Projection, i: number, j: number): number => projection[i * 4 + j]!;

function isOrthogonal(projection: Projection): boolean {
  return column(projection, 2, 3) === 0;
}

/** The downsample's linearisation of a reversed depth: `z_near / (z_far - depth)`, or the planes of an orthogonal one. */
export interface SsaoDepthLinearize {
  z_near: number;
  z_far: number;
  isOrthogonal: boolean;
}

/**
 * `downsample_depth`'s push constants (`ss_effects.cpp:582-600`): the projection with Godot's
 * depth correction, unflipped (`projection.cpp:787-806`), gives the linearisation.
 */
export function ssaoDepthLinearize(projection: Projection): SsaoDepthLinearize {
  if (isOrthogonal(projection)) {
    const m22 = column(projection, 2, 2);
    const m32 = column(projection, 3, 2);
    const m33 = column(projection, 3, 3);
    return { z_near: (m33 + m32) / m22, z_far: (m33 - m32) / -m22, isOrthogonal: true };
  }
  // The corrected row is `-0.5 * z + 0.5 * w`.
  const corrected22 = -0.5 * column(projection, 2, 2) + 0.5 * column(projection, 2, 3);
  const corrected32 = -0.5 * column(projection, 3, 2) + 0.5 * column(projection, 3, 3);
  const mul = -corrected32;
  const add = mul * corrected22 < 0 ? -corrected22 : corrected22;
  return { z_near: mul, z_far: add, isOrthogonal: false };
}

/** The gather's push constants (`ss_effects.cpp:1162-1205`), by Godot's names. */
export interface SsaoGatherParameters {
  quality: number;
  half_screen_pixel_size: [number, number];
  half_screen_pixel_size_x025: [number, number];
  size_multiplier: number;
  detail_intensity: number;
  NDC_to_view_mul: [number, number];
  NDC_to_view_add: [number, number];
  is_orthogonal: boolean;
  radius: number;
  intensity: number;
  shadow_power: number;
  shadow_clamp: number;
  fade_out_mul: number;
  fade_out_add: number;
  horizon_angle_threshold: number;
  inv_radius_near_limit: number;
  neg_inv_radius: number;
  load_counter_avg_div: number;
  adaptive_sample_limit: number;
}

/** The Environment's own SSAO settings the gather reads. */
interface SsaoEnvironment {
  radius: number;
  intensity: number;
  power: number;
  detail: number;
  horizon: number;
}

/** The gather's push constants for `frame`, the internal size, seen through `projection`. */
export function ssaoGatherParameters(
  ssao: SsaoEnvironment,
  project: SsaoProjectSettings,
  frame: BufferSize,
  projection: Projection
): SsaoGatherParameters {
  const { quality, isHalfSize } = project;
  const texelScale = isHalfSize ? 4 : 2;
  const halfScreenPixelSize: [number, number] = [texelScale / frame.width, texelScale / frame.height];
  const tanHalfFovX = 1 / column(projection, 0, 0);
  const tanHalfFovY = 1 / column(projection, 1, 1);
  let radius = ssao.radius;
  let radiusNearLimit = ssao.radius * 1.2;
  if (quality <= SSAO_QUALITY.LOW) {
    radiusNearLimit *= 1.5;
    if (quality === SSAO_QUALITY.VERY_LOW) radius *= 0.8;
  }
  radiusNearLimit /= tanHalfFovY;
  const fadeRange = project.fadeoutTo - project.fadeoutFrom;
  const { half } = ssaoBufferSizes(frame, isHalfSize);
  return {
    quality: Math.max(0, quality - 1),
    half_screen_pixel_size: halfScreenPixelSize,
    half_screen_pixel_size_x025: [halfScreenPixelSize[0] * 0.75, halfScreenPixelSize[1] * 0.75],
    size_multiplier: isHalfSize ? 2 : 1,
    detail_intensity: ssao.detail,
    NDC_to_view_mul: [tanHalfFovX * 2, tanHalfFovY * -2],
    NDC_to_view_add: [-tanHalfFovX, tanHalfFovY],
    is_orthogonal: isOrthogonal(projection),
    radius,
    intensity: ssao.intensity,
    shadow_power: ssao.power,
    shadow_clamp: 0.98,
    fade_out_mul: -1 / fadeRange,
    fade_out_add: project.fadeoutFrom / fadeRange + 1,
    horizon_angle_threshold: ssao.horizon,
    inv_radius_near_limit: 1 / radiusNearLimit,
    neg_inv_radius: -1 / radius,
    load_counter_avg_div: 9 / (half.width * half.height * 255),
    adaptive_sample_limit: project.adaptiveTarget,
  };
}
