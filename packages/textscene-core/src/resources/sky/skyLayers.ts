/**
 * Godot's roughest radiance layers of a sky, which its ambient and its rough reflections read
 * (`scene_forward_clustered.glsl:1714-1756`). A chain of downsamples shrinks the radiance to an
 * octmap 10 texels wide, and a GGX filter per layer takes the cosine-weighted mean of that chain
 * around each direction (`godot/skyReflection.ts`). The chain blurs the sky wider than three's PMREM.
 */

import * as THREE from 'three';
import { octToVec3WithBorder, vec3ToOctWithBorder, type OctDirection } from '../../godot/octmap.js';
import {
  SKY_RADIANCE_SIZE_DEFAULT,
  downsampleTaps,
  layerSamples,
  skyOctmapLayout,
  type LayerSample,
  type SkyOctmapLayout,
} from '../../godot/skyReflection.js';
import { cubeFace, cubeTexel, texelDirection } from './cubeFaces.js';
import { addBilinear, addTrilinear, blankOctmap, type Octmap } from './octmapImage.js';

/**
 * Bound once, not read from `Math` per call: a global lookup inside a VM context, where the
 * vitest pool runs this, costs about 100 times a local one, in a loop that runs a million times.
 */
const { abs, floor, hypot } = Math;

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

/**
 * Godot's layout depends on `Sky.radiance_size` only through the chain's length, as the last mip
 * is 10 texels wide at every size. So the default size stands for every size.
 */
const LAYOUT = skyOctmapLayout(SKY_RADIANCE_SIZE_DEFAULT);

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

/** The parts of the filter that hold for every sky, for one cube size. */
interface LayerPlan {
  cubeSize: number;
  /** The face times the face's texel count, plus the texel, that each base octmap texel reads. */
  baseTexels: Int32Array;
  steps: DownsampleStep[];
  /** The samples of each baked layer. */
  samples: LayerSample[][];
}

/**
 * Written only by `layerPlan`, on the first sky of a cube size. About 4 MB, kept so a later sky
 * runs the chain without the 400,000 directions and 500,000 tap weights that build it.
 */
let plan: LayerPlan | null = null;

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
    return Float32Array.from(half, THREE.DataUtils.fromHalfFloat);
  });
}

/** Godot's baked layers of the sky `radiance` holds, a cube of RGBA faces `size` wide. */
export function skyLayers(radiance: readonly Float32Array[], size: number): SkyLayers {
  checkCube(radiance, size);
  const { baseTexels, steps, samples } = layerPlan(size);
  const mips: Octmap[] = [];
  let source = baseOctmap(radiance, size * size, baseTexels);
  for (const step of steps) {
    source = downsample(source, step);
    mips.push(source);
  }
  const layers = BAKED_FACE_SIZES.map((faceSize, index) =>
    Array.from({ length: 6 }, (_, face) => layerFace(face, faceSize, mips, samples[index]!))
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

function layerPlan(cubeSize: number): LayerPlan {
  if (plan?.cubeSize === cubeSize) return plan;
  plan = {
    cubeSize,
    baseTexels: baseTexels(cubeSize, LAYOUT),
    steps: LAYOUT.downsampledSizes.map((size) => downsampleStep(size, LAYOUT.padding)),
    samples: BAKED_FACE_SIZES.map((_, index) => layerSamples(LAYOUT, FIRST_BAKED_LAYER + index)),
  };
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

function baseOctmap(radiance: readonly Float32Array[], faceTexels: number, texels: Int32Array): Octmap {
  const octmap = blankOctmap(LAYOUT.size);
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
  samples: readonly LayerSample[]
): Uint16Array {
  const out = new Uint16Array(faceSize * faceSize * 4);
  const colour = new Float32Array(3);
  for (let texel = 0; texel < faceSize * faceSize; texel += 1) {
    layerAt(texelDirection(face, texel, faceSize), mips, samples, colour);
    out.set(
      [colour[0]!, colour[1]!, colour[2]!, 1].map((value) => THREE.DataUtils.toHalfFloat(value)),
      texel * 4
    );
  }
  return out;
}

/** The UV of one sample. Written only by `layerAt`, for the sample it reads next. */
const sampleUv = new Float64Array(2);

/**
 * Writes the texel of a layer at `normal` to `out`: the layer's samples turned into the frame Godot
 * builds around it, read from the mips and weighed by their cosine (`octmap_roughness.glsl:62-84`).
 */
function layerAt(
  normal: OctDirection,
  mips: readonly Octmap[],
  samples: readonly LayerSample[],
  out: Float32Array
): void {
  const up: OctDirection = abs(normal[1]) < 0.99999 ? [0, 1, 0] : [0, 0, 1];
  const tangent = normalize(cross(up, normal));
  const bitangent = cross(normal, tangent);
  out.fill(0);
  let total = 0;
  for (const {
    direction: [x, y, z],
    lod,
  } of samples) {
    vec3ToOctWithBorder(
      tangent[0] * x + bitangent[0] * y + normal[0] * z,
      tangent[1] * x + bitangent[1] * y + normal[1] * z,
      tangent[2] * x + bitangent[2] * y + normal[2] * z,
      LAYOUT.padding,
      sampleUv
    );
    addTrilinear(mips, sampleUv[0]!, sampleUv[1]!, lod, z, out);
    total += z;
  }
  for (let channel = 0; channel < 3; channel += 1) out[channel] = out[channel]! / total;
}

function cross(a: OctDirection, b: OctDirection): OctDirection {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize([x, y, z]: OctDirection): OctDirection {
  const length = hypot(x, y, z);
  return [x / length, y / length, z / length];
}
