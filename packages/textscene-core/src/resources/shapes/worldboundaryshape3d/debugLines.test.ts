/**
 * Tests for the editor outline of a WorldBoundaryShape3D. The expected vertices come from
 * Godot 4.6.3 `get_debug_mesh()` (`world_boundary_shape_3d.cpp:36-63`), measured by an oracle
 * script that sets each plane and reads the line mesh back.
 */

import { describe, expect, it } from 'vitest';
import { worldBoundaryDebugLines } from './debugLines';

/** Plane `[nx, ny, nz, d]` and the 10 vertices (5 segments) Godot draws for it. */
const GODOT_LINES: readonly (readonly [string, number[], number[]])[] = [
  [
    'the default plane',
    [0, 1, 0, 0],
    [
      10, 0, -10, 10, 0, 10, 10, 0, 10, -10, 0, 10, -10, 0, 10, -10, 0, -10, -10, 0, -10, 10, 0, -10, 0, 0, 0,
      0, 3, 0,
    ],
  ],
  [
    'an x normal with an offset',
    [1, 0, 0, 2.5],
    [
      2.5, 10, 10, 2.5, 10, -10, 2.5, 10, -10, 2.5, -10, -10, 2.5, -10, -10, 2.5, -10, 10, 2.5, -10, 10, 2.5,
      10, 10, 2.5, 0, 0, 5.5, 0, 0,
    ],
  ],
  [
    'a non-unit normal',
    [0, 2, 0, -1],
    [
      10, -2, -10, 10, -2, 10, 10, -2, 10, -10, -2, 10, -10, -2, 10, -10, -2, -10, -10, -2, -10, 10, -2, -10,
      0, -2, 0, 0, 4, 0,
    ],
  ],
  [
    'a tilted unit normal',
    [0.6, 0.8, 0, 1.5],
    [
      8.9, -4.8, -10, 8.9, -4.8, 10, 8.9, -4.8, 10, -7.1, 7.2, 10, -7.1, 7.2, 10, -7.1, 7.2, -10, -7.1, 7.2,
      -10, 8.9, -4.8, -10, 0.9, 1.2, 0, 2.7, 3.6, 0,
    ],
  ],
  [
    'a unit normal with three components',
    [0.2, 0.3, -0.9, 0.7],
    [
      9.95023, -9.88997, -1.95286, 9.95023, 9.08369, 4.3717, 9.95023, 9.08369, 4.3717, -9.67023, 10.31,
      0.69286, -9.67023, 10.31, 0.69286, -9.67023, -8.66369, -5.6317, -9.67023, -8.66369, -5.6317, 9.95023,
      -9.88997, -1.95286, 0.14, 0.21, -0.63, 0.74, 1.11, -3.33,
    ],
  ],
  [
    'a normal near the x axis (the other perpendicular seed)',
    [0.995, 0.1, 0, 1],
    [
      -0.00501, 10.0499, 10, -0.00501, 10.0499, -10, -0.00501, 10.0499, -10, 1.99501, -9.84987, -10, 1.99501,
      -9.84987, -10, 1.99501, -9.84987, 10, 1.99501, -9.84987, 10, -0.00501, 10.0499, 10, 0.995, 0.1, 0, 3.98,
      0.4, 0,
    ],
  ],
];

describe('worldBoundaryDebugLines', () => {
  it.each(GODOT_LINES)('matches Godot for %s', (_name, [nx, ny, nz, d], expected) => {
    const lines = worldBoundaryDebugLines({ normal: { x: nx!, y: ny!, z: nz! }, d: d! });
    expect(lines).toHaveLength(expected.length);
    expected.forEach((value, index) => expect(lines[index]).toBeCloseTo(value, 4));
  });
});
