/**
 * The 2D navmesh overlay lands in three.js's +Y-up space.
 *
 * `navigation_region_2d.cpp::_update_debug_mesh()` copies the polygon's
 * vertices VERBATIM into the debug mesh and draws it under the region's Node2D
 * global transform with an identity mesh transform — so the numbers in a
 * `NavigationPolygon` are raw local canvas pixels in Godot's **+Y-down** space.
 * A vertex at local `(0, 128)` is 128 px BELOW the region's origin.
 *
 * `vector2ToPositions` copied that y straight through, so the whole navmesh —
 * fill and edge lines alike — rendered MIRRORED about the region's origin, the
 * one 2D geometry path that skipped the Y negation every other 2D slice does
 * (see `node2dGroupProps`).
 */
import { describe, expect, it } from 'vitest';
import { vector2ToPositions } from './navigationOverlay';
import { decodeNavigationPolygon } from '../resources/navigation/navigationpolygon';

describe('vector2ToPositions', () => {
  it('negates Y so Godot +Y-down becomes three.js +Y-up', () => {
    const positions = vector2ToPositions(new Float32Array([0, 128, 64, -32]));
    expect([...positions]).toEqual([0, -128, 0, 64, 32, 0]);
  });

  it('passes X through and pins every vertex to z = 0', () => {
    const positions = vector2ToPositions(new Float32Array([10, 20, 30, 40]));
    expect(positions[0]).toBe(10);
    expect(positions[3]).toBe(30);
    expect(positions[2]).toBe(0);
    expect(positions[5]).toBe(0);
  });

  it('keeps +0 for a zero Y rather than flipping it to -0', () => {
    expect(Object.is(vector2ToPositions(new Float32Array([5, 0]))[1], 0)).toBe(true);
  });

  it('ignores a trailing odd value', () => {
    expect(vector2ToPositions(new Float32Array([1, 2, 3])).length).toBe(3);
  });

  it('is the only place the negation happens — the slice decode hands over raw Godot Y', () => {
    // Negating inside decodeNavigationPolygon too would mirror the navmesh back.
    const polygon = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 0, 128, 64, 128)',
      polygons: 'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2)])',
    });
    expect(polygon!.vertices[3]).toBe(128);
    expect([...vector2ToPositions(polygon!.vertices)]).toEqual([0, 0, 0, 0, -128, 0, 64, -128, 0]);
  });
});
