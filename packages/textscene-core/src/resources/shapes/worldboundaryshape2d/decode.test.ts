/**
 * WorldBoundaryShape2D decode: normal and distance. `set_normal` ERR_FAILs a zero normal
 * (`world_boundary_shape_2d.cpp:64`) and keeps the `Vector2(0, -1)` default (`.h:39`).
 */

import { describe, expect, it } from 'vitest';
import { decodeWorldBoundaryShape2D } from './decode';

describe('decodeWorldBoundaryShape2D', () => {
  it('honours the normal and the distance, a non-unit normal as authored', () => {
    expect(decodeWorldBoundaryShape2D({ normal: 'Vector2(0, 2)', distance: '-15' })).toEqual({
      normal: { x: 0, y: 2 },
      distance: -15,
    });
  });

  it('falls back to a normal of (0, -1) and a distance of 0 when absent', () => {
    expect(decodeWorldBoundaryShape2D({})).toEqual({ normal: { x: 0, y: -1 }, distance: 0 });
  });

  it('refuses a zero normal the way Godot ERR_FAILs it', () => {
    expect(decodeWorldBoundaryShape2D({ normal: 'Vector2(0, 0)' }).normal).toEqual({ x: 0, y: -1 });
  });
});
