/** The cell grid of a VoxelGI gizmo (`voxel_gi_gizmo_plugin.cpp:117-153`). */
import { describe, expect, it } from 'vitest';
import type { Aabb } from '../../godot/math/aabb';
import { cellGridLines } from './cellGrid';

function box(px: number, py: number, pz: number, sx: number, sy: number, sz: number): Aabb {
  return { position: { x: px, y: py, z: pz }, size: { x: sx, y: sy, z: sz } };
}

/** The segments of `lines`, each as its six numbers. */
function segments(lines: number[]): number[][] {
  return Array.from({ length: lines.length / 6 }, (_, index) => lines.slice(index * 6, index * 6 + 6));
}

describe('cellGridLines', () => {
  it('draws four segments on each plane of the first axis, in the order of k (worked example)', () => {
    // Cell size 4 / 4 = 1, so the first plane is at x = 1.
    const [first, second, third, fourth] = segments(cellGridLines(box(0, 0, 0, 4, 2, 2), 4));
    expect([first, second, third, fourth]).toEqual([
      [1, 0, 0, 1, 0, 2],
      [1, 0, 0, 1, 2, 0],
      [1, 2, 2, 1, 0, 2],
      [1, 2, 2, 1, 2, 0],
    ]);
  });

  it('skips the planes that lie past the size of a shorter axis', () => {
    // X: 3 planes. Y and Z: planes at 1 and 2, and the one at 3 lies past the size of 2.
    expect(segments(cellGridLines(box(0, 0, 0, 4, 2, 2), 4))).toHaveLength((3 + 2 + 2) * 4);
  });

  it('draws 127 x 3 x 4 segments for a cube of 20 and 128 subdivisions', () => {
    const cube = box(-10, -10, -10, 20, 20, 20);
    expect(segments(cellGridLines(cube, 128))).toHaveLength(1524);
  });

  it('starts at the least corner and steps by the cell size (20 / 128 = 0.15625)', () => {
    const cube = box(-10, -10, -10, 20, 20, 20);
    expect(segments(cellGridLines(cube, 128))[0]).toEqual([-9.84375, -10, -10, -9.84375, -10, 10]);
  });

  it('draws a plane that ends on the size of a shorter axis (edge case)', () => {
    // Cell size 40 / 64 = 0.625: Y and Z reach 10 at the 16th plane, which is not past the size.
    expect(segments(cellGridLines(box(-20, -5, -5, 40, 10, 10), 64))).toHaveLength((63 + 16 + 16) * 4);
  });

  it('compares in float32, as the engine does: a plane that float32 rounds onto the size is drawn (edge case)', () => {
    // Math.fround(13.3) / 64 * 5 is 1.0390625 in float32 and a hair above it in float64.
    // The Y and Z planes 1 to 5 are drawn, and the X planes 1 to 63.
    expect(cellGridLines(box(0, 0, 0, Math.fround(13.3), 1.0390625, 1.0390625), 64)).toHaveLength(
      (63 + 5 + 5) * 4 * 6
    );
  });

  it('draws nothing for one subdivision (edge case)', () => {
    expect(cellGridLines(box(0, 0, 0, 2, 2, 2), 1)).toEqual([]);
  });

  it('draws segments of no length for a box of size 0 (edge case)', () => {
    // Cell size 0: no plane lies past the size, so every plane draws, all at the corner.
    const drawn = segments(cellGridLines(box(0, 0, 0, 0, 0, 0), 4));
    expect([drawn.length, drawn.flat().every((n) => n === 0)]).toEqual([3 * 3 * 4, true]);
  });
});
