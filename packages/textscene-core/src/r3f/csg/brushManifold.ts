/**
 * Whether Godot's manifold keeps a CSG brush. `_pack_manifold` welds every corner within
 * `CSG_MERGE_TOLERANCE` and builds a `Manifold` (`csg_shape.cpp:425-431`), which is empty unless
 * faces run both ways along each edge. An empty brush adds nothing to the solid.
 */

import { CSG_MERGE_TOLERANCE } from '../../godot/scene/csg';

/** A hash of a weld-grid cell. Two cells can share one, which only adds a candidate to check. */
function cellHash(x: number, y: number, z: number): number {
  return Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
}

/**
 * Each corner of the triangles `isWelded` names, as the first corner it welds to. Manifold welds
 * every point within `CSG_MERGE_TOLERANCE` of another. The grid's cells are twice that wide, so a
 * partner lies in the corner's own cell or the neighbour on the side it leans to, on each axis:
 * 8 cells, not 27. A corner of any other triangle reads -1.
 */
export function weldCorners(positions: Float32Array, isWelded: (triangle: number) => boolean): Int32Array {
  const welds = new Int32Array(Math.floor(positions.length / 9) * 3).fill(-1);
  const cells = new Map<number, number[]>();
  const toleranceSq = CSG_MERGE_TOLERANCE ** 2;
  const cellWidth = 2 * CSG_MERGE_TOLERANCE;
  const partnerIn = (hash: number, x: number, y: number, z: number): number => {
    const members = cells.get(hash);
    if (!members) return -1;
    for (const r of members) {
      const dx = positions[r * 3]! - x;
      const dy = positions[r * 3 + 1]! - y;
      const dz = positions[r * 3 + 2]! - z;
      if (dx * dx + dy * dy + dz * dz <= toleranceSq) return r;
    }
    return -1;
  };
  for (let corner = 0; corner < welds.length; corner++) {
    if (!isWelded((corner / 3) | 0)) continue;
    const x = positions[corner * 3]!;
    const y = positions[corner * 3 + 1]!;
    const z = positions[corner * 3 + 2]!;
    const [fx, fy, fz] = [x / cellWidth, y / cellWidth, z / cellWidth];
    const [cx, cy, cz] = [Math.floor(fx), Math.floor(fy), Math.floor(fz)];
    // A corner in the lower half of its cell leans to the cell below, in the upper half to the cell above.
    const [lx, ly, lz] = [fx - cx < 0.5 ? -1 : 1, fy - cy < 0.5 ? -1 : 1, fz - cz < 0.5 ? -1 : 1];
    const own = cellHash(cx, cy, cz);
    let weld = partnerIn(own, x, y, z);
    for (let n = 1; weld === -1 && n < 8; n++) {
      weld = partnerIn(
        cellHash(cx + (n & 1 ? lx : 0), cy + (n & 2 ? ly : 0), cz + (n & 4 ? lz : 0)),
        x,
        y,
        z
      );
    }
    if (weld === -1) {
      weld = corner;
      const members = cells.get(own);
      if (members) members.push(corner);
      else cells.set(own, [corner]);
    }
    welds[corner] = weld;
  }
  return welds;
}

/** Triangle `t` with two corners welded together, which manifold collapses out of the brush. */
export function isCollapsed(welds: Int32Array, t: number): boolean {
  const [a, b, c] = [welds[t * 3], welds[t * 3 + 1], welds[t * 3 + 2]];
  return a === b || b === c || a === c;
}

/**
 * Whether the triangle soup `positions` (nine floats a triangle) is a manifold: after the weld
 * and the collapse, each edge carries as many faces one way as the other. A brush that wound the
 * other way, or has four faces on an edge, stays closed, and an empty brush has no edge to leave open.
 */
export function isClosedBrush(positions: Float32Array): boolean {
  const welds = weldCorners(positions, () => true);
  const corners = welds.length;
  /** Faces along each edge's lower-to-higher direction, less those the other way; absent at zero. */
  const unpaired = new Map<number, number>();
  for (let t = 0; t < corners / 3; t++) {
    if (isCollapsed(welds, t)) continue;
    for (let j = 0; j < 3; j++) {
      const from = welds[t * 3 + j]!;
      const to = welds[t * 3 + ((j + 1) % 3)]!;
      const isAscending = from < to;
      const edge = isAscending ? from * corners + to : to * corners + from;
      const count = (unpaired.get(edge) ?? 0) + (isAscending ? 1 : -1);
      if (count === 0) unpaired.delete(edge);
      else unpaired.set(edge, count);
    }
  }
  return unpaired.size === 0;
}
