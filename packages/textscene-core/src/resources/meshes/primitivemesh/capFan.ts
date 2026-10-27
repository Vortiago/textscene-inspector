/**
 * The cap a CylinderMesh or TubeTrailMesh closes an end with: a fan from a centre vertex to each rim
 * column, with the same UVs, winding and tangent in both (`primitive_meshes.cpp:1168-1260`,
 * `:2596-2732`).
 */

import { storedReal } from '../../../godot/math/real.js';
import type { RimColumn } from './rimPoint.js';
import type { SurfaceWriter, Vec2, Vec4 } from './surfaceWriter.js';

/** A UV or UV2 at a point on the unit disc the cap fills. */
type DiscUv = (x: number, z: number) => Vec2;

/** The tangent of every cap vertex (`:1175`, `:2609`). */
const CAP_TANGENT: Vec4 = [1, 0, 0, 1];

/** What differs between the two caps: which way they face, where their UV sits, and their winding. */
export interface CapFace {
  normalY: 1 | -1;
  uv: DiscUv;
  /** Whether the fan's triangles take the newer rim vertex first, so the cap faces down. */
  isFlipped: boolean;
}

/**
 * A fan facing up, centred on (0.25, 0.75) in UV (`:1169`, `:2596-2677`).
 *
 * @canonical The cap of a cylinder or a tube
 */
export const TOP_CAP: CapFace = {
  normalY: 1,
  uv: (x, z) => [storedReal((x + 1) * 0.25), storedReal(0.5 + (z + 1) * 0.25)],
  isFlipped: false,
};

/**
 * A fan facing down, centred on (0.75, 0.75) in UV with V mirrored (`:1216`, `:2680-2732`).
 *
 * @canonical The cap of a cylinder or a tube
 */
export const BOTTOM_CAP: CapFace = {
  normalY: -1,
  uv: (x, z) => [storedReal(0.5 + (x + 1) * 0.25), storedReal(1 - (z + 1) * 0.25)],
  isFlipped: true,
};

/** No UV2: a writer without `add_uv2` drops it, so every cap vertex shares one frozen tuple. */
const ZERO_UV2: Vec2 = Object.freeze([0, 0] as const);
const NO_UV2: DiscUv = () => ZERO_UV2;

/**
 * The centre at `y`, then each column of `rim` at `radius`.
 *
 * @canonical The cap of a cylinder or a tube
 */
export function writeCapFan(
  writer: SurfaceWriter,
  rim: readonly RimColumn[],
  { normalY, uv, isFlipped }: CapFace,
  y: number,
  radius: number,
  uv2: DiscUv = NO_UV2
): void {
  const normal = [0, normalY, 0] as const;
  const centre = writer.vertexCount;
  writer.vertex([0, y, 0], normal, CAP_TANGENT, uv(0, 0), uv2(0, 0));
  rim.forEach(({ x, z }, i) => {
    writer.vertex([x * radius, y, z * radius], normal, CAP_TANGENT, uv(x, z), uv2(x, z));
    const point = writer.vertexCount;
    if (i === 0) return;
    if (isFlipped) writer.triangle(centre, point - 2, point - 1);
    else writer.triangle(centre, point - 1, point - 2);
  });
}
