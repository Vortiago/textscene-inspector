/**
 * The buffers of one world buffer's screen-space reflection, as `ssr_allocate_buffers` and
 * `allocate_last_frame_buffer` size them (`ss_effects.cpp:366-394`, `:1432-1471`). Each holds
 * Godot's rows, top row first.
 */

import * as THREE from 'three';
import { ssrMipCount, ssrTraceSize } from '../../godot/rendering/environment/screenSpaceReflection.js';

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
  /** The samples resolved into one frame, as Godot resolves them. Null for a frame of one sample. */
  readonly resolved: { depth: THREE.WebGLRenderTarget; normalRoughness: THREE.WebGLRenderTarget } | null;
  /** The size the trace runs at: the world buffer's, or half of it. */
  readonly traceSize: THREE.Vector2;
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
  /** The reflection at the world buffer's size, as the colour pass reads it. */
  readonly reflection: THREE.WebGLRenderTarget;
  /** The last frame, at the trace's size, cleared to zero before the first frame. */
  readonly lastFrame: THREE.WebGLRenderTarget;
  readonly isHalfSize: boolean;

  constructor(shape: ReflectionShape) {
    const { width, height, samples, isHalfSize } = shape;
    this.shape = { ...shape };
    this.isHalfSize = isHalfSize;
    const trace = ssrTraceSize({ width, height }, isHalfSize);
    this.traceSize = new THREE.Vector2(trace.width, trace.height);
    this.mipCount = ssrMipCount(trace);
    this.samplePrepasses = Array.from({ length: Math.max(1, samples) }, () => prepassTarget(width, height));
    this.resolved =
      samples > 1
        ? {
            depth: new THREE.WebGLRenderTarget(width, height, DEPTH_LEVEL),
            normalRoughness: new THREE.WebGLRenderTarget(width, height, NORMAL_ROUGHNESS),
          }
        : null;
    this.hiz = chainTarget(trace.width, trace.height, {
      ...DEPTH_LEVEL,
      minFilter: THREE.NearestMipmapNearestFilter,
    });
    this.hizLevels = levelTargets(trace.width, trace.height, this.mipCount, DEPTH_LEVEL);
    this.normalRoughness = new THREE.WebGLRenderTarget(trace.width, trace.height, NORMAL_ROUGHNESS);
    this.trace = traceTarget(trace.width, trace.height);
    this.chain = chainTarget(trace.width, trace.height, {
      ...HALF_FLOAT_LINEAR,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.chainLevels = levelTargets(trace.width, trace.height, this.mipCount, HALF_FLOAT_LINEAR);
    this.reflection = new THREE.WebGLRenderTarget(width, height, { ...NEAREST, type: THREE.HalfFloatType });
    this.lastFrame = new THREE.WebGLRenderTarget(trace.width, trace.height, HALF_FLOAT_LINEAR);
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
    return this.resolved?.depth.texture ?? this.samplePrepasses[0]!.depthTexture!;
  }

  /** The frame's encoded normal and roughness, in three's rows. */
  get frameNormalRoughness(): THREE.Texture {
    return this.resolved?.normalRoughness.texture ?? this.samplePrepasses[0]!.texture;
  }

  /**
   * Allocates every target a copy reads or writes. A copy into a target no draw has bound finds none
   * of its levels, and a target first bound between a draw and its copy leaves its own texture on the
   * active unit, which the copy then writes into: a feedback loop.
   */
  allocate(renderer: THREE.WebGLRenderer): void {
    for (const target of [this.hiz, this.chain, this.trace, ...this.hizLevels, ...this.chainLevels]) {
      renderer.initRenderTarget(target);
    }
  }

  /** The target mip `level` of the depth pyramid draws into, from 1. */
  hizLevel(level: number): THREE.WebGLRenderTarget {
    return this.hizLevels[level - 1]!;
  }

  /** The target mip `level` of the roughness chain draws into, from 1. */
  chainLevel(level: number): THREE.WebGLRenderTarget {
    return this.chainLevels[level - 1]!;
  }

  dispose(): void {
    for (const prepass of this.samplePrepasses) prepass.depthTexture?.dispose();
    for (const target of this.targets()) target.dispose();
  }

  private targets(): THREE.WebGLRenderTarget[] {
    const own = [this.hiz, this.normalRoughness, this.trace, this.chain, this.reflection, this.lastFrame];
    const resolved = this.resolved ? [this.resolved.depth, this.resolved.normalRoughness] : [];
    return [...this.samplePrepasses, ...resolved, ...own, ...this.hizLevels, ...this.chainLevels];
  }
}

/** The normal and roughness, over a 32-bit float depth that the passes read back. */
function prepassTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, { ...NORMAL_ROUGHNESS, depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
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

/**
 * A texture with a level for every mip down to one texel, so a read across its mips finds it
 * complete: three sets no `TEXTURE_MAX_LEVEL`. Only Godot's mips are drawn, and every read keeps
 * to them. A render target reads only the count (three r186 `WebGLTextures.js:2070-2076`).
 */
function chainTarget(
  width: number,
  height: number,
  options: THREE.RenderTargetOptions
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, options);
  const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
  target.texture.mipmaps = Array.from({ length: levels }, () => ({})) as unknown as THREE.Texture['mipmaps'];
  return target;
}

function levelTargets(
  width: number,
  height: number,
  mipCount: number,
  options: THREE.RenderTargetOptions
): LevelTargets {
  return Array.from({ length: mipCount - 1 }, (_, index) => {
    const level = index + 1;
    return new THREE.WebGLRenderTarget(Math.max(1, width >> level), Math.max(1, height >> level), options);
  });
}
