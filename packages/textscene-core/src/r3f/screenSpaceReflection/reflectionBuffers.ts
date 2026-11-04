/**
 * The buffers of one world buffer's screen-space reflection, as `ssr_allocate_buffers` and
 * `allocate_last_frame_buffer` size them (`ss_effects.cpp:366-394`, `:1432-1471`). Each holds
 * Godot's rows, top row first.
 */

import * as THREE from 'three';
import { ssrMipCount, ssrTraceSize } from '../../godot/rendering/environment/screenSpaceReflection.js';
import { createPassTarget, NEAREST_TARGET } from '../environment/passTarget.js';
import { NORMAL_ROUGHNESS } from '../screenSpaceEffects/prepassBuffers.js';
import { reversedTexelRows, type TexelPlacement } from '../texelCopy.js';
import { FILTER_RADIUS } from './ssrShaders.js';

/**
 * What each mip of a chain from mip 1 renders into before it is copied into that mip, as WebGL reads
 * no level of a texture that a draw writes. Mip 0 is drawn or copied straight in.
 */
type LevelTargets = readonly THREE.WebGLRenderTarget[];

/** Godot's R16G16B16A16_SFLOAT colour, read through its linear clamped sampler. */
const HALF_FLOAT_LINEAR: THREE.RenderTargetOptions = {
  ...NEAREST_TARGET,
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
};

/** The roughness filter's blur across, kept at the 32 bits Godot's shared cache holds it in. */
const FLOAT_ACROSS: THREE.RenderTargetOptions = { ...NEAREST_TARGET, type: THREE.FloatType };

/** Godot's R32_SFLOAT depth pyramid. */
const DEPTH_LEVEL: THREE.RenderTargetOptions = {
  ...NEAREST_TARGET,
  type: THREE.FloatType,
  format: THREE.RedFormat,
};

/** The world buffer a reflection serves, and the project's setting the trace runs at. */
export interface ReflectionShape {
  width: number;
  height: number;
  isHalfSize: boolean;
}

export class ReflectionBuffers {
  readonly shape: ReflectionShape;
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
    const { width, height, isHalfSize } = shape;
    this.shape = { ...shape };
    const trace = ssrTraceSize({ width, height }, isHalfSize);
    this.mipCount = ssrMipCount(trace);
    this.rowsReversed = reversedTexelRows(width, height);
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
    this.chainAcross = levelTargets(
      trace.width,
      trace.height,
      this.mipCount,
      FLOAT_ACROSS,
      2 * FILTER_RADIUS
    );
    this.reflection = createPassTarget('SsrReflection', NEAREST_TARGET);
    this.reflection.setSize(width, height);
    this.lastFrame = createPassTarget('SsrLastFrame', HALF_FLOAT_LINEAR);
    this.lastFrame.setSize(trace.width, trace.height);
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

  /** The target the blur across of mip `level` of the roughness chain draws into, from 1. */
  chainAcrossLevel(level: number): THREE.WebGLRenderTarget {
    return this.chainAcross[level - 1]!;
  }

  dispose(): void {
    for (const target of this.targets()) target.dispose();
  }

  private targets(): THREE.WebGLRenderTarget[] {
    const own = [this.hiz, this.normalRoughness, this.trace, this.chain, this.reflection, this.lastFrame];
    return [...own, ...this.hizLevels, ...this.chainLevels, ...this.chainAcross];
  }
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
