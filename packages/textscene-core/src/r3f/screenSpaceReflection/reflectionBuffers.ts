/**
 * The buffers of one world buffer's screen-space reflection, as `ssr_allocate_buffers` and
 * `allocate_last_frame_buffer` size them (`ss_effects.cpp:366-394`, `:1432-1471`). Each holds
 * Godot's rows, top row first.
 */

import * as THREE from 'three';
import { ssrMipCount, ssrTraceSize } from '../../godot/rendering/environment/screenSpaceReflection.js';
import { createPassTarget } from '../environment/passTarget.js';
import { withMipLevels } from '../mipLevels.js';
import { reversedTexelRows, type TexelPlacement } from '../texelCopy.js';
import { FILTER_RADIUS } from './ssrShaders.js';

/**
 * What each mip of a chain from mip 1 renders into before it is copied into that mip, as WebGL reads
 * no level of a texture that a draw writes. Mip 0 is drawn or copied straight in.
 */
type LevelTargets = readonly THREE.WebGLRenderTarget[];

const NEAREST: THREE.RenderTargetOptions = {
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
};

/** Godot's R16G16B16A16_SFLOAT colour, read through its linear clamped sampler. */
const HALF_FLOAT_LINEAR: THREE.RenderTargetOptions = {
  ...NEAREST,
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
};

/** The roughness filter's blur across, kept at the 32 bits Godot's shared cache holds it in. */
const FLOAT_ACROSS: THREE.RenderTargetOptions = { ...NEAREST, type: THREE.FloatType };

/** Godot's R32_SFLOAT depth pyramid. */
const DEPTH_LEVEL: THREE.RenderTargetOptions = { ...NEAREST, type: THREE.FloatType, format: THREE.RedFormat };

/** Godot's R8G8B8A8_UNORM normal and roughness. */
const NORMAL_ROUGHNESS: THREE.RenderTargetOptions = { ...NEAREST, type: THREE.UnsignedByteType };

/** The world buffer a reflection serves, and the project's setting the trace runs at. */
export interface ReflectionShape {
  width: number;
  height: number;
  /** The world buffer's samples per pixel, 0 for one. */
  samples: number;
  isHalfSize: boolean;
}

export class ReflectionBuffers {
  readonly shape: ReflectionShape;
  /**
   * The normal and roughness, and the depth, of each sample of the frame at the world buffer's size,
   * as WebGL reads no multisampled texture. One target for a frame of one sample.
   */
  readonly samplePrepasses: readonly THREE.WebGLRenderTarget[];
  /**
   * The samples resolved into one frame, as Godot resolves them: the depth, then the normal and
   * roughness. Null for a frame of one sample.
   */
  readonly resolved: THREE.WebGLRenderTarget | null;
  /** The frame's rows in Godot's order, which the trace reads at full size. */
  readonly rowsReversed: TexelPlacement;
  readonly mipCount: number;
  /** The depth pyramid, nearest the camera of each block, one level per mip. */
  readonly hiz: THREE.WebGLRenderTarget;
  private readonly hizLevels: LevelTargets;
  /**
   * The normal and roughness the trace reads, in Godot's rows: at half size, of the sample the depth
   * pyramid's base keeps.
   */
  readonly normalRoughness: THREE.WebGLRenderTarget;
  /** The trace's colour, then the mip each pixel's roughness reads. */
  readonly trace: THREE.WebGLRenderTarget;
  /** The traced colour, blurred more at each mip by the roughness filter. */
  readonly chain: THREE.WebGLRenderTarget;
  private readonly chainLevels: LevelTargets;
  /** Each mip of the chain from 1 blurred across, with the rows past each edge that the blur down reads. */
  private readonly chainAcross: LevelTargets;
  /** The reflection at the world buffer's size, as the colour pass reads it. */
  readonly reflection: THREE.WebGLRenderTarget;
  /** The last frame, at the trace's size, cleared to zero before the first frame. */
  readonly lastFrame: THREE.WebGLRenderTarget;

  /**
   * Allocates every target a copy reads or writes. A copy into a target no draw has bound finds none
   * of its levels, and a target first bound between a draw and its copy leaves its own texture on the
   * active unit, which the copy then writes into: a feedback loop.
   */
  constructor(renderer: THREE.WebGLRenderer, shape: ReflectionShape) {
    const { width, height, samples, isHalfSize } = shape;
    this.shape = { ...shape };
    const trace = ssrTraceSize({ width, height }, isHalfSize);
    this.mipCount = ssrMipCount(trace);
    this.samplePrepasses = Array.from({ length: Math.max(1, samples) }, () => prepassTarget(width, height));
    this.resolved = samples > 1 ? resolvedTarget(width, height) : null;
    this.rowsReversed = reversedTexelRows(width, height);
    this.hiz = chainTarget(trace.width, trace.height, this.mipCount, {
      ...DEPTH_LEVEL,
      minFilter: THREE.NearestMipmapNearestFilter,
    });
    this.hizLevels = levelTargets(trace.width, trace.height, this.mipCount, DEPTH_LEVEL);
    this.normalRoughness = new THREE.WebGLRenderTarget(trace.width, trace.height, NORMAL_ROUGHNESS);
    this.trace = traceTarget(trace.width, trace.height);
    this.chain = chainTarget(trace.width, trace.height, this.mipCount, {
      ...HALF_FLOAT_LINEAR,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.chainLevels = levelTargets(trace.width, trace.height, this.mipCount, HALF_FLOAT_LINEAR);
    this.chainAcross = levelTargets(
      trace.width,
      trace.height,
      this.mipCount,
      FLOAT_ACROSS,
      2 * FILTER_RADIUS
    );
    this.reflection = createPassTarget('SsrReflection', NEAREST);
    this.reflection.setSize(width, height);
    this.lastFrame = createPassTarget('SsrLastFrame', HALF_FLOAT_LINEAR);
    this.lastFrame.setSize(trace.width, trace.height);
    for (const target of [this.hiz, this.chain, this.trace, ...this.hizLevels, ...this.chainLevels]) {
      renderer.initRenderTarget(target);
    }
  }

  fits(shape: ReflectionShape): boolean {
    const own = this.shape;
    return (
      own.width === shape.width &&
      own.height === shape.height &&
      own.samples === shape.samples &&
      own.isHalfSize === shape.isHalfSize
    );
  }

  /** The frame's depth in three's form, 0 at the near plane, in three's rows. */
  get frameDepth(): THREE.Texture {
    return this.resolved?.textures[0] ?? this.samplePrepasses[0]!.depthTexture!;
  }

  /** The frame's encoded normal and roughness, in three's rows. */
  get frameNormalRoughness(): THREE.Texture {
    return this.resolved?.textures[1] ?? this.samplePrepasses[0]!.texture;
  }

  /** The target mip `level` of the depth pyramid draws into, from 1. */
  hizLevel(level: number): THREE.WebGLRenderTarget {
    return this.hizLevels[level - 1]!;
  }

  /** The target mip `level` of the roughness chain draws into, from 1. */
  chainLevel(level: number): THREE.WebGLRenderTarget {
    return this.chainLevels[level - 1]!;
  }

  /** The target the blur across of mip `level` of the roughness chain draws into, from 1. */
  chainAcrossLevel(level: number): THREE.WebGLRenderTarget {
    return this.chainAcross[level - 1]!;
  }

  dispose(): void {
    for (const prepass of this.samplePrepasses) prepass.depthTexture?.dispose();
    for (const target of this.targets()) target.dispose();
  }

  private targets(): THREE.WebGLRenderTarget[] {
    const own = [this.hiz, this.normalRoughness, this.trace, this.chain, this.reflection, this.lastFrame];
    const resolved = this.resolved ? [this.resolved] : [];
    return [
      ...this.samplePrepasses,
      ...resolved,
      ...own,
      ...this.hizLevels,
      ...this.chainLevels,
      ...this.chainAcross,
    ];
  }
}

/** The normal and roughness, over a 32-bit float depth that the passes read back. */
function prepassTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...NORMAL_ROUGHNESS, depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
  return target;
}

/** The resolve's R32F depth beside its RGBA8 normal and roughness, both drawn by one pass. */
function resolvedTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...NORMAL_ROUGHNESS, count: 2 });
  const depth = target.textures[0]!;
  depth.type = THREE.FloatType;
  depth.format = THREE.RedFormat;
  return target;
}

/** Godot's R8 mip store sits beside the colour, as the trace writes both (`screen_space_reflection.glsl:24-25`). */
function traceTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...HALF_FLOAT_LINEAR, count: 2 });
  const mipLevel = target.textures[1]!;
  mipLevel.type = THREE.UnsignedByteType;
  mipLevel.format = THREE.RedFormat;
  mipLevel.minFilter = THREE.NearestFilter;
  mipLevel.magFilter = THREE.NearestFilter;
  return target;
}

/** A target of `levels` mips, as many as Godot draws, which a read across its mips finds complete. */
function chainTarget(
  width: number,
  height: number,
  levels: number,
  options: THREE.RenderTargetOptions
): THREE.WebGLRenderTarget {
  return withMipLevels(new THREE.WebGLRenderTarget(width, height, options), levels);
}

/** A target for each mip from 1 of a chain `width` by `height`, each `extraRows` taller than its mip. */
function levelTargets(
  width: number,
  height: number,
  mipCount: number,
  options: THREE.RenderTargetOptions,
  extraRows = 0
): LevelTargets {
  return Array.from({ length: mipCount - 1 }, (_, index) => {
    const level = index + 1;
    const rows = Math.max(1, height >> level) + extraRows;
    return new THREE.WebGLRenderTarget(Math.max(1, width >> level), rows, options);
  });
}
