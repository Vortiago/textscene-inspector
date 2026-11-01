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
const SH_WEIGHTS = [
  Math.sqrt(1 / (4 * Math.PI)) * Math.PI,
  (Math.sqrt(3 / (4 * Math.PI)) * Math.PI * 2) / 3,
  (Math.sqrt(15 / (4 * Math.PI)) * Math.PI) / 4,
  (Math.sqrt(5 / (16 * Math.PI)) * Math.PI) / 4,
  (Math.sqrt(15 / (16 * Math.PI)) * Math.PI) / 4,
].map(Math.fround);
const [W0, W1, W2, W3, W4] = SH_WEIGHTS as [number, number, number, number, number];

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
    indices.set(
      SPHERE_INDICES.map((index) => index + point * VERTICES_PER_SPHERE),
      point * SPHERE_INDICES.length
    );
  }
  return { positions, colors, indices };
}

function writeSphere(
  positions: Float32Array,
  colors: Float32Array,
  point: number,
  points: Float32Array,
  sh: Float32Array,
  radius: number
): void {
  const stackStep = Math.PI / STACKS;
  const sectorStep = (Math.PI * 2) / SECTORS;
  let vertex = point * VERTICES_PER_SPHERE * 3;
  for (let stack = 0; stack <= STACKS; stack++) {
    const stackAngle = Math.PI / 2 - stack * stackStep;
    const ring = radius * Math.cos(stackAngle);
    const height = radius * Math.sin(stackAngle);
    for (let sector = 0; sector <= SECTORS; sector++) {
      const sectorAngle = sector * sectorStep;
      // Godot swaps the sphere's y and z: the poles lie on +Y (`:178`).
      const offset: Vec3 = [ring * Math.cos(sectorAngle), height, ring * Math.sin(sectorAngle)];
      for (let axis = 0; axis < 3; axis++)
        positions[vertex + axis] = points[point * 3 + axis]! + offset[axis]!;
      colors.set(shLight(sh, point, offset, radius), vertex);
      vertex += 3;
    }
  }
}

type Vec3 = [number, number, number];

/** The light of the SH colours of `point` toward the direction of `offset` (`:180-193`). */
function shLight(sh: Float32Array, point: number, offset: Vec3, radius: number): Vec3 {
  const x = offset[0] / radius;
  const y = offset[1] / radius;
  const z = offset[2] / radius;
  const weights = [
    W0,
    W1 * y,
    W1 * z,
    W1 * x,
    W2 * x * y,
    W2 * y * z,
    W3 * (3 * z * z - 1),
    W2 * x * z,
    W4 * (x * x - y * y),
  ];
  const light: Vec3 = [0, 0, 0];
  for (let colour = 0; colour < SH_COLOURS; colour++) {
    const base = (point * SH_COLOURS + colour) * COLOUR_FLOATS;
    for (let channel = 0; channel < 3; channel++) light[channel]! += weights[colour]! * sh[base + channel]!;
  }
  return light;
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
