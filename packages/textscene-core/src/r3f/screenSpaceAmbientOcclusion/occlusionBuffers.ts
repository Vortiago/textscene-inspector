/**
 * The buffers of one world buffer's screen-space ambient occlusion, as `downsample_depth` and
 * `ssao_allocate_buffers` size them (`ss_effects.cpp:510-515`, `:1098-1128`). Each holds Godot's
 * rows, top row first. Where Godot keeps an array texture, this keeps one texture per slice, and
 * where it keeps mips, one target per level, as a draw writes all of its target's attachments.
 */

import * as THREE from 'three';
import {
  ssaoBufferSizes,
  ssaoDepthDownsample,
  ssaoDepthLevelSize,
  SSAO_QUALITY,
  type SsaoDepthDownsample,
  type SsaoProjectSettings,
} from '../../godot/rendering/environment/screenSpaceAmbientOcclusion.js';

/** The four deinterleaved slices of each buffer (`ss_effects.cpp:1145-1149`). */
const SLICE_COUNT = 4;

/** The four mips of the linear depth the gather reads (`ss_effects.cpp:1212`). */
const GATHER_DEPTH_LEVELS = 4;

const NEAREST: THREE.RenderTargetOptions = {
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
};

/** Godot's R16_SFLOAT linear depth, one texture per slice. */
const DEPTH_LEVEL: THREE.RenderTargetOptions = {
  ...NEAREST,
  type: THREE.HalfFloatType,
  format: THREE.RedFormat,
  count: SLICE_COUNT,
};

/**
 * Godot's R8G8_UNORM slice of the occlusion and its packed edges. The default sampler's linear
 * filter is the slice's own, so a pass that reads through the mirror sampler fetches its texels.
 */
const SLICE: THREE.RenderTargetOptions = {
  ...NEAREST,
  type: THREE.UnsignedByteType,
  format: THREE.RGFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
};

/** Godot's R8_UNORM importance map and final occlusion, read through the default linear sampler. */
const R8_LINEAR: THREE.RenderTargetOptions = { ...SLICE, format: THREE.RedFormat };

/** The load counter's sum, which a 32-bit float holds exactly up to 2^24. */
const LOAD_COUNTER: THREE.RenderTargetOptions = {
  ...NEAREST,
  type: THREE.FloatType,
  format: THREE.RedFormat,
};

/** The world buffer an occlusion serves, and the project's settings that shape its buffers. */
export interface OcclusionShape {
  width: number;
  height: number;
  project: SsaoProjectSettings;
}

export class OcclusionBuffers {
  readonly shape: OcclusionShape;
  readonly downsample: SsaoDepthDownsample;
  /** The slices' linear depth, one target per mip the downsample writes, by level. */
  private readonly depthLevels: ReadonlyMap<number, THREE.WebGLRenderTarget>;
  /** The gathered occlusion of each slice, and its blurred copies (`RB_DEINTERLEAVED`). */
  readonly deinterleaved: readonly THREE.WebGLRenderTarget[];
  /** The other half of the blur's ping-pong, and the base pass's output at Ultra (`RB_DEINTERLEAVED_PONG`). */
  readonly pong: readonly THREE.WebGLRenderTarget[];
  /** Ultra's importance map and its blur, null below Ultra. */
  readonly importance: THREE.WebGLRenderTarget | null;
  readonly importancePong: THREE.WebGLRenderTarget | null;
  /** Ultra's load counter, one texel, null below Ultra. */
  readonly loadCounter: THREE.WebGLRenderTarget | null;
  /** The occlusion at the world buffer's size, as the colour pass reads it (`RB_FINAL`). */
  readonly occlusion: THREE.WebGLRenderTarget;

  constructor(shape: OcclusionShape) {
    const { width, height, project } = shape;
    this.shape = { ...shape, project: { ...project } };
    this.downsample = ssaoDepthDownsample(project);
    this.depthLevels = depthLevelTargets(shape, this.downsample);
    const { buffer, half } = ssaoBufferSizes({ width, height }, project.isHalfSize);
    this.deinterleaved = sliceTargets(buffer.width, buffer.height);
    this.pong = sliceTargets(buffer.width, buffer.height);
    const isAdaptive = project.quality === SSAO_QUALITY.ULTRA;
    this.importance = isAdaptive ? new THREE.WebGLRenderTarget(half.width, half.height, R8_LINEAR) : null;
    this.importancePong = isAdaptive ? new THREE.WebGLRenderTarget(half.width, half.height, R8_LINEAR) : null;
    this.loadCounter = isAdaptive ? new THREE.WebGLRenderTarget(1, 1, LOAD_COUNTER) : null;
    this.occlusion = new THREE.WebGLRenderTarget(width, height, R8_LINEAR);
  }

  fits(shape: OcclusionShape): boolean {
    const own = this.shape;
    return (
      own.width === shape.width &&
      own.height === shape.height &&
      (Object.keys(own.project) as (keyof SsaoProjectSettings)[]).every(
        (key) => own.project[key] === shape.project[key]
      )
    );
  }

  /** The target of mip `level` of the linear depth, which the downsample writes. */
  depthLevel(level: number): THREE.WebGLRenderTarget {
    const target = this.depthLevels.get(level);
    if (!target) throw new Error(`expected a depth level the downsample writes, got ${level}`);
    return target;
  }

  /**
   * Slice `slice` of each of the gather's four depth mips, from the gather's level 0. A mip the
   * downsample writes none of is read only at a quality that writes it, so the last written stands in.
   */
  gatherDepth(slice: number): THREE.Texture[] {
    const { gatherLevel, baseLevel, mipLevels } = this.downsample;
    const top = baseLevel + mipLevels;
    return Array.from(
      { length: GATHER_DEPTH_LEVELS },
      (_, level) => this.depthLevel(Math.min(gatherLevel + level, top)).textures[slice]!
    );
  }

  dispose(): void {
    for (const target of this.targets()) target.dispose();
  }

  private targets(): THREE.WebGLRenderTarget[] {
    const adaptive = [this.importance, this.importancePong, this.loadCounter].filter(
      (target): target is THREE.WebGLRenderTarget => target !== null
    );
    return [...this.depthLevels.values(), ...this.deinterleaved, ...this.pong, ...adaptive, this.occlusion];
  }
}

function depthLevelTargets(
  { width, height }: OcclusionShape,
  { baseLevel, mipLevels }: SsaoDepthDownsample
): Map<number, THREE.WebGLRenderTarget> {
  const levels = new Map<number, THREE.WebGLRenderTarget>();
  for (let level = baseLevel; level <= baseLevel + mipLevels; level++) {
    const size = ssaoDepthLevelSize({ width, height }, level);
    levels.set(level, new THREE.WebGLRenderTarget(size.width, size.height, DEPTH_LEVEL));
  }
  return levels;
}

function sliceTargets(width: number, height: number): THREE.WebGLRenderTarget[] {
  return Array.from({ length: SLICE_COUNT }, () => new THREE.WebGLRenderTarget(width, height, SLICE));
}
