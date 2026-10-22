/**
 * The cell grid inside the box of a VoxelGI gizmo: on each axis, the planes a cell apart, each drawn
 * as four segments across the other two axes.
 */

import { aabbLongestAxisSize, type Aabb } from '../../godot/math/aabb';
import { VECTOR3_AXES } from '../../godot/math/vector';

/** The engine holds the cell size and the sizes it compares as `float`: a plane can round onto a size. */
const f = Math.fround;

/**
 * Flat `xyz` segment ends of the planes `box` has for `subdivisions` cells along its longest axis
 * (`voxel_gi_gizmo_plugin.cpp:117-153`).
 * A plane past the size of a shorter axis is not drawn.
 */
export function cellGridLines(box: Aabb, subdivisions: number): number[] {
  const { position, size } = box;
  const cellSize = f(f(aabbLongestAxisSize(box)) / subdivisions);
  const lines: number[] = [];
  for (let plane = 1; plane < subdivisions; plane++) {
    VECTOR3_AXES.forEach((axis, index) => {
      if (f(cellSize * plane) > f(size[axis])) return;
      const first = VECTOR3_AXES[(index + 1) % 3]!;
      const second = VECTOR3_AXES[(index + 2) % 3]!;
      for (let corner = 0; corner < 4; corner++) {
        const from = { ...position };
        const to = { ...position };
        from[axis] += cellSize * plane;
        to[axis] += cellSize * plane;
        if (corner & 1) to[first] += size[first];
        else to[second] += size[second];
        if (corner & 2) {
          from[first] += size[first];
          from[second] += size[second];
        }
        lines.push(from.x, from.y, from.z, to.x, to.y, to.z);
      }
    });
  }
  return lines;
}
