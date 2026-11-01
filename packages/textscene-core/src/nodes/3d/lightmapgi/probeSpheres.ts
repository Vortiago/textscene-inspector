/**
 * The mesh of the LightmapGI gizmo's probe spheres: one UV sphere for each capture point, lit at each
 * vertex by the point's L2 spherical harmonics (`lightmap_gi_gizmo_plugin.cpp:126-223`).
 */

import type { CaptureProbes } from '../../../resources/lightmapgidata/captureProbes';

/** The sphere's grid (`lightmap_gi_gizmo_plugin.cpp:128-129`). */
const STACKS = 8;
const SECTORS = 16;
const VERTICES_PER_SPHERE = (STACKS + 1) * (SECTORS + 1);

const SH_COLOURS = 9;
const COLOUR_FLOATS = 4;

/**
 * The diffuse convolution weight of each SH band (`:149-156`). Godot stores them as `float`, so
 * each is rounded to one.
 */
const W0 = Math.fround(Math.sqrt(1 / (4 * Math.PI)) * Math.PI);
const W1 = Math.fround((Math.sqrt(3 / (4 * Math.PI)) * Math.PI * 2) / 3);
const W2 = Math.fround((Math.sqrt(15 / (4 * Math.PI)) * Math.PI) / 4);
const W3 = Math.fround((Math.sqrt(5 / (16 * Math.PI)) * Math.PI) / 4);
const W4 = Math.fround((Math.sqrt(15 / (16 * Math.PI)) * Math.PI) / 4);

/**
 * The unit direction of each sphere vertex, and the weight of each SH colour toward it
 * (`:180-193`), for the one sphere every probe shares. Godot swaps the sphere's y and z: the poles
 * lie on +Y (`:178`).
 */
interface SphereTable {
  directions: Float32Array;
  weights: Float32Array;
}

function buildSphereTable(): SphereTable {
  const directions = new Float32Array(VERTICES_PER_SPHERE * 3);
  const weights = new Float32Array(VERTICES_PER_SPHERE * SH_COLOURS);
  let vertex = 0;
  for (let stack = 0; stack <= STACKS; stack++) {
    const stackAngle = Math.PI / 2 - (stack * Math.PI) / STACKS;
    for (let sector = 0; sector <= SECTORS; sector++, vertex++) {
      const sectorAngle = (sector * Math.PI * 2) / SECTORS;
      const x = Math.cos(stackAngle) * Math.cos(sectorAngle);
      const y = Math.sin(stackAngle);
      const z = Math.cos(stackAngle) * Math.sin(sectorAngle);
      directions.set([x, y, z], vertex * 3);
      weights.set(
        [
          W0,
          W1 * y,
          W1 * z,
          W1 * x,
          W2 * x * y,
          W2 * y * z,
          W3 * (3 * z * z - 1),
          W2 * x * z,
          W4 * (x * x - y * y),
        ],
        vertex * SH_COLOURS
      );
    }
  }
  return { directions, weights };
}

/**
 * The triangles of one sphere, each stack's quads split in two, without the degenerate half at each
 * pole (`:195-214`). Godot winds the front face clockwise and three counter-clockwise, so each triangle
 * lists its last two vertices the other way round.
 */
function buildSphereIndices(): Uint32Array {
  const indices: number[] = [];
  for (let stack = 0; stack < STACKS; stack++) {
    let current = stack * (SECTORS + 1);
    let next = current + SECTORS + 1;
    for (let sector = 0; sector < SECTORS; sector++, current++, next++) {
      if (stack !== 0) indices.push(current, current + 1, next);
      if (stack !== STACKS - 1) indices.push(current + 1, next + 1, next);
    }
  }
  return Uint32Array.from(indices);
}

const SPHERE_TABLE = buildSphereTable();
const SPHERE_INDICES = buildSphereIndices();

export interface ProbeSphereMesh {
  /** Flat `xyz` of each vertex. */
  positions: Float32Array;
  /** Flat linear `rgb` of each vertex, which is not clamped. */
  colors: Float32Array;
  indices: Uint32Array;
}

/** The spheres of radius `radius` at each point of `probes`. A radius of zero builds none (`:147`). */
export function probeSphereMesh(
  { points, sh }: Pick<CaptureProbes, 'points' | 'sh'>,
  radius: number
): ProbeSphereMesh {
  const pointCount = radius === 0 ? 0 : points.length / 3;
  const positions = new Float32Array(pointCount * VERTICES_PER_SPHERE * 3);
  const colors = new Float32Array(positions.length);
  const indices = new Uint32Array(pointCount * SPHERE_INDICES.length);
  for (let point = 0; point < pointCount; point++) {
    writeSphere(positions, colors, point, points, sh, radius);
    writeIndices(indices, point);
  }
  return { positions, colors, indices };
}

function writeIndices(indices: Uint32Array, point: number): void {
  const base = point * VERTICES_PER_SPHERE;
  const start = point * SPHERE_INDICES.length;
  for (let i = 0; i < SPHERE_INDICES.length; i++) indices[start + i] = SPHERE_INDICES[i]! + base;
}

function writeSphere(
  positions: Float32Array,
  colors: Float32Array,
  point: number,
  points: Float32Array,
  sh: Float32Array,
  radius: number
): void {
  for (let vertex = 0; vertex < VERTICES_PER_SPHERE; vertex++) {
    const out = (point * VERTICES_PER_SPHERE + vertex) * 3;
    for (let axis = 0; axis < 3; axis++) {
      positions[out + axis] =
        points[point * 3 + axis]! + SPHERE_TABLE.directions[vertex * 3 + axis]! * radius;
    }
    for (let colour = 0; colour < SH_COLOURS; colour++) {
      const weight = SPHERE_TABLE.weights[vertex * SH_COLOURS + colour]!;
      const base = (point * SH_COLOURS + colour) * COLOUR_FLOATS;
      for (let channel = 0; channel < 3; channel++) colors[out + channel]! += weight * sh[base + channel]!;
    }
  }
}
