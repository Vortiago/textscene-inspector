/**
 * Godot's filtered radiance layers of a sky, 1 to 7, which its ambient and its reflections read
 * (`scene_forward_clustered.glsl:1714-1756`). Layer 0 is the radiance itself. A chain of downsamples
 * shrinks the radiance to an octmap 10 texels wide, and a filter per layer reads that chain around
 * each direction: GGX importance sampling, or the fast filter of a real-time sky.
 */

import * as THREE from 'three';
import { octToVec3WithBorder } from '../../godot/octmap.js';
import {
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  downsampleTaps,
  type SkyOctmapLayout,
} from '../../godot/skyReflection.js';
import { cubeFace, cubeTexel, texelDirection } from './cubeFaces.js';
import { fastFilter } from './fastFilter.js';
import { importanceSampleFilter } from './importanceSampleFilter.js';
import type { LayerFilter } from './layerFilter.js';
import { addBilinear, blankOctmap, type Octmap } from './octmapImage.js';
import type { SkyBake } from './types.js';

/**
 * Bound once, not read from `Math` per call: a global lookup inside a VM context, where the
 * vitest pool runs this, costs about 100 times a local one, in a loop that runs a million times.
 */
const { floor } = Math;
const { toHalfFloat } = THREE.DataUtils;

/** A group of layers shown as one cube: its first layer, and the face size of each layer from there. */
export interface SkyLayerGroup {
  readonly firstLayer: number;
  readonly faceSizes: readonly number[];
}

/**
 * Godot's layers 1 to 7 in three groups. Within a group each layer halves the one before, so the group is a cube's mip chain and a trilinear
 * read blends two layers as Godot does. A layer's faces are about as fine as the chain mip its filter
 * reads, so the sharp layers' first is about as fine as the 320-wide half-size copy.
 */
export const SKY_LAYER_GROUPS = {
  sharp: { firstLayer: 1, faceSizes: [128, 64, 32] },
  rough: { firstLayer: 4, faceSizes: [32, 16, 8] },
  /** The layer the ambient reads, smooth enough that linear filtering between texels 6 degrees apart follows it. */
  last: { firstLayer: SKY_ROUGHNESS_LAYERS_DEFAULT - 1, faceSizes: [16] },
} as const satisfies Record<string, SkyLayerGroup>;

/** Godot's layers 1 to 7 of a sky, as six RGBA half-float faces each, in the layout of `cubeFaces.ts`. */
export type SkyLayers = Record<keyof typeof SKY_LAYER_GROUPS, Uint16Array[][]>;

/** Half-float 1, the alpha of every texel. */
const OPAQUE = toHalfFloat(1);

/** One downsample of the chain, as positions and weights that hold for every sky. */
interface DownsampleStep {
  size: number;
  /** The near and the far tap's U of each column. */
  columns: Float32Array;
  /** The near and the far tap's V of each row. */
  rows: Float32Array;
  /** The four tap weights of each texel. */
  weights: Float32Array;
}

/**
 * Written only by `baseTexelsOf`, on the first sky of a cube size and octmap size: the face times
 * the face's texel count, plus the texel, that each octmap texel reads. 1.6 MB at 256, kept so a
 * later sky builds its octmap without the 400,000 directions that place it. A key per size, not
 * one slot: skies of two sizes in turn would each place them again.
 */
const baseTexelsBySize = new Map<string, Int32Array>();

/**
 * Written only by `stepsOf`, on a filter's first sky. They hold for every sky, and save the 500,000
 * tap weights that build them.
 */
const chainSteps = new Map<LayerFilter, DownsampleStep[]>();

/**
 * Each face of a WebGL cube render target, as linear RGBA floats in `readRenderTargetPixels`
 * order. A synchronous read, not `LightProbeGenerator.fromCubeRenderTarget`: that one is async,
 * and the sky's layers must be ready on the frame its background is.
 */
export function readCubeRadiance(
  gl: THREE.WebGLRenderer,
  target: THREE.WebGLCubeRenderTarget
): Float32Array[] {
  const size = target.width;
  const half = new Uint16Array(size * size * 4);
  return Array.from({ length: 6 }, (_, face) => {
    gl.readRenderTargetPixels(target, 0, 0, size, size, half, face);
    return fromHalfFloats(half);
  });
}

/** A plain loop, not `Float32Array.from` with a mapper: 16 ms against 217 ms on six 256² faces. */
function fromHalfFloats(half: Uint16Array): Float32Array {
  const floats = new Float32Array(half.length);
  for (let i = 0; i < half.length; i += 1) floats[i] = THREE.DataUtils.fromHalfFloat(half[i]!);
  return floats;
}

/**
 * Godot's baked layers of the sky `radiance` holds, a cube of RGBA faces as wide as the bake's
 * radiance size. The cube stands for Godot's radiance octmap of the same size, which is twice as
 * wide to match a cube's texel density (`sky.cpp:1553-1554`).
 */
export function skyLayers(radiance: readonly Float32Array[], bake: SkyBake): SkyLayers {
  const size = bake.radianceSize;
  checkCube(radiance, size);
  const filter = bake.radianceFilter === 'fast' ? fastFilter : importanceSampleFilter(size);
  const mips: Octmap[] = [];
  let source = baseOctmap(radiance, size * size, filter.layout.size, baseTexelsOf(size, filter.layout));
  for (const step of stepsOf(filter)) {
    source = downsample(source, step);
    mips.push(source);
  }
  const group = ({ firstLayer, faceSizes }: SkyLayerGroup) =>
    faceSizes.map((faceSize, index) =>
      Array.from({ length: 6 }, (_, face) => layerFace(face, faceSize, mips, filter, firstLayer + index))
    );
  return {
    sharp: group(SKY_LAYER_GROUPS.sharp),
    rough: group(SKY_LAYER_GROUPS.rough),
    last: group(SKY_LAYER_GROUPS.last),
  };
}

function checkCube(radiance: readonly Float32Array[], size: number): void {
  if (radiance.length !== 6) throw new Error(`expected 6 cube faces, got ${radiance.length}`);
  radiance.forEach((face, index) => {
    if (face.length !== size * size * 4) {
      throw new Error(
        `expected 6 RGBA faces of ${size}x${size}, got face ${index} with ${face.length} values`
      );
    }
  });
}

function stepsOf(filter: LayerFilter): DownsampleStep[] {
  let steps = chainSteps.get(filter);
  if (steps) return steps;
  steps = filter.chainSizes.map((size) => downsampleStep(size, filter.layout.padding));
  chainSteps.set(filter, steps);
  return steps;
}

function baseTexelsOf(cubeSize: number, layout: SkyOctmapLayout): Int32Array {
  const key = `${cubeSize}:${layout.size}`;
  let texels = baseTexelsBySize.get(key);
  if (!texels) {
    texels = baseTexels(cubeSize, layout);
    baseTexelsBySize.set(key, texels);
  }
  return texels;
}

/** The cube texel nearest each texel of the radiance octmap, padding included. */
function baseTexels(cubeSize: number, { size, padding }: SkyOctmapLayout): Int32Array {
  const texels = new Int32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const direction = octToVec3WithBorder((x + 0.5) / size, (y + 0.5) / size, 1 - padding * 2);
      texels[y * size + x] = cubeFace(direction) * cubeSize * cubeSize + cubeTexel(direction, cubeSize);
    }
  }
  return texels;
}

function downsampleStep(size: number, padding: number): DownsampleStep {
  const step: DownsampleStep = {
    size,
    columns: new Float32Array(size * 2),
    rows: new Float32Array(size * 2),
    weights: new Float32Array(size * size * 4),
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [nearNear, farNear, nearFar, farFar] = downsampleTaps(x, y, size, padding);
      step.weights.set(
        [nearNear!.weight, farNear!.weight, nearFar!.weight, farFar!.weight],
        (y * size + x) * 4
      );
      step.columns.set([nearNear!.u, farNear!.u], x * 2);
      step.rows.set([nearNear!.v, nearFar!.v], y * 2);
    }
  }
  return step;
}

function baseOctmap(
  radiance: readonly Float32Array[],
  faceTexels: number,
  octmapSize: number,
  texels: Int32Array
): Octmap {
  const octmap = blankOctmap(octmapSize);
  for (let i = 0; i < texels.length; i += 1) {
    const face = radiance[floor(texels[i]! / faceTexels)]!;
    const at = (texels[i]! % faceTexels) * 4;
    octmap.rgb[i * 3] = face[at]!;
    octmap.rgb[i * 3 + 1] = face[at + 1]!;
    octmap.rgb[i * 3 + 2] = face[at + 2]!;
  }
  return octmap;
}

/** One mip of the chain `octmap_downsampler.glsl` builds, from the mip above. */
function downsample(source: Octmap, { size, columns, rows, weights }: DownsampleStep): Octmap {
  const mip = blankOctmap(size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const texel = y * size + x;
      const at = texel * 3;
      const w = texel * 4;
      addBilinear(source, columns[x * 2]!, rows[y * 2]!, weights[w]!, mip.rgb, at);
      addBilinear(source, columns[x * 2 + 1]!, rows[y * 2]!, weights[w + 1]!, mip.rgb, at);
      addBilinear(source, columns[x * 2]!, rows[y * 2 + 1]!, weights[w + 2]!, mip.rgb, at);
      addBilinear(source, columns[x * 2 + 1]!, rows[y * 2 + 1]!, weights[w + 3]!, mip.rgb, at);
    }
  }
  return mip;
}

function layerFace(
  face: number,
  faceSize: number,
  mips: readonly Octmap[],
  filter: LayerFilter,
  layer: number
): Uint16Array {
  const out = new Uint16Array(faceSize * faceSize * 4);
  const colour = new Float32Array(3);
  for (let texel = 0; texel < faceSize * faceSize; texel += 1) {
    filter.texel(texelDirection(face, texel, faceSize), mips, layer, colour);
    const at = texel * 4;
    out[at] = toHalfFloat(colour[0]!);
    out[at + 1] = toHalfFloat(colour[1]!);
    out[at + 2] = toHalfFloat(colour[2]!);
    out[at + 3] = OPAQUE;
  }
  return out;
}
