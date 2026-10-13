/**
 * Godot's roughest radiance layers of a sky, which its ambient and its rough reflections read
 * (`scene_forward_clustered.glsl:1714-1756`). A chain of downsamples shrinks the radiance to an
 * octmap 10 texels wide, and a filter per layer reads that chain around each direction: GGX
 * importance sampling, or the fast filter of a real-time sky. The chain blurs the sky wider than
 * three's PMREM.
 */

import * as THREE from 'three';
import { octToVec3WithBorder } from '../../godot/octmap.js';
import { downsampleTaps, type SkyOctmapLayout } from '../../godot/skyReflection.js';
import { cubeFace, cubeTexel, texelDirection } from './cubeFaces.js';
import { fastFilter } from './fastFilter.js';
import { importanceSampleFilter } from './importanceSampleFilter.js';
import type { LayerFilter } from './layerFilter.js';
import { addBilinear, blankOctmap, type Octmap } from './octmapImage.js';
import type { RadianceFilter } from './types.js';

/**
 * Bound once, not read from `Math` per call: a global lookup inside a VM context, where the
 * vitest pool runs this, costs about 100 times a local one, in a loop that runs a million times.
 */
const { floor } = Math;

/** The first layer baked here. The layers below it are sharp enough for three's PMREM to follow. */
export const FIRST_BAKED_LAYER = 4;

/**
 * The face size of each baked layer before the last. Each halves the one before, so the layers form
 * a cube's mip chain, and a trilinear read blends two of them as Godot does.
 */
export const ROUGH_LAYER_FACE_SIZES = [32, 16, 8];

/**
 * The face size of the last layer, which the ambient reads. The layer is smooth, so linear filtering
 * between texels 6 degrees apart follows it.
 */
export const LAST_LAYER_FACE_SIZE = 16;

/** Godot's baked layers of a sky, as six RGBA half-float faces each, in the layout of `cubeFaces.ts`. */
export interface SkyLayers {
  /** The layers from `FIRST_BAKED_LAYER` up to the last, at `ROUGH_LAYER_FACE_SIZES`. */
  rough: Uint16Array[][];
  /** The last layer, at `LAST_LAYER_FACE_SIZE`. */
  last: Uint16Array[];
}

const BAKED_FACE_SIZES = [...ROUGH_LAYER_FACE_SIZES, LAST_LAYER_FACE_SIZE];

const FILTERS: Record<RadianceFilter, LayerFilter> = {
  'importance-sample': importanceSampleFilter,
  fast: fastFilter,
};

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

/** The parts of a filter's chain that hold for every sky, for one cube size. */
interface ChainPlan {
  cubeSize: number;
  /** The face times the face's texel count, plus the texel, that each base octmap texel reads. */
  baseTexels: Int32Array;
  steps: DownsampleStep[];
}

/**
 * Written only by `chainPlan`, on the first sky of a cube size for each filter. Up to 4 MB each, kept
 * so a later sky runs the chain without the 400,000 directions and 500,000 tap weights that build it.
 */
const plans = new Map<LayerFilter, ChainPlan>();

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
 * Godot's baked layers of the sky `radiance` holds, a cube of RGBA faces `size` wide, through
 * `radianceFilter`.
 */
export function skyLayers(
  radiance: readonly Float32Array[],
  size: number,
  radianceFilter: RadianceFilter
): SkyLayers {
  checkCube(radiance, size);
  const filter = FILTERS[radianceFilter];
  const { baseTexels, steps } = chainPlan(size, filter);
  const mips: Octmap[] = [];
  let source = baseOctmap(radiance, size * size, baseTexels, filter.layout.size);
  for (const step of steps) {
    source = downsample(source, step);
    mips.push(source);
  }
  const layers = BAKED_FACE_SIZES.map((faceSize, index) =>
    Array.from({ length: 6 }, (_, face) => layerFace(face, faceSize, mips, filter, FIRST_BAKED_LAYER + index))
  );
  return { rough: layers.slice(0, -1), last: layers.at(-1)! };
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

function chainPlan(cubeSize: number, filter: LayerFilter): ChainPlan {
  const cached = plans.get(filter);
  if (cached?.cubeSize === cubeSize) return cached;
  const { layout, chainSizes } = filter;
  const plan: ChainPlan = {
    cubeSize,
    baseTexels: baseTexels(cubeSize, layout),
    steps: chainSizes.map((size) => downsampleStep(size, layout.padding)),
  };
  plans.set(filter, plan);
  return plan;
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
  texels: Int32Array,
  octmapSize: number
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
    out.set(
      [colour[0]!, colour[1]!, colour[2]!, 1].map((value) => THREE.DataUtils.toHalfFloat(value)),
      texel * 4
    );
  }
  return out;
}
