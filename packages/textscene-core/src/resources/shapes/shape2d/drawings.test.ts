/**
 * What each Shape2D class's `draw()` puts on the canvas item, in draw order. The expected points
 * are worked from the Godot source by hand (`scene/resources/2d/*_shape_2d.cpp`), not recomputed.
 */
import { describe, expect, it } from 'vitest';
import type { Vector2 } from '../../../godot/math/vector';
import {
  capsuleDrawing,
  circleDrawing,
  concavePolygonDrawing,
  convexPolygonDrawing,
  rectangleDrawing,
  segmentDrawing,
  separationRayDrawing,
  worldBoundaryDrawing,
} from './drawings';
import type { ShapeCommand } from './drawing';

function expectPointsClose(actual: readonly Vector2[], expected: readonly Vector2[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((point, i) => {
    expect(actual[i]!.x).toBeCloseTo(point.x, 5);
    expect(actual[i]!.y).toBeCloseTo(point.y, 5);
  });
}

function only<K extends ShapeCommand['kind']>(
  commands: readonly ShapeCommand[],
  kind: K
): Extract<ShapeCommand, { kind: K }>[] {
  return commands.filter((c): c is Extract<ShapeCommand, { kind: K }> => c.kind === kind);
}

describe('rectangleDrawing (rectangle_shape_2d.cpp:73-89)', () => {
  const commands = rectangleDrawing({ size: { x: 40, y: 30 } });

  it('fills the rectangle in the shape colour, then outlines it opaque with five points', () => {
    expect(commands.map((c) => c.kind)).toEqual(['fill', 'hairline']);
    expect(commands[0]).toMatchObject({ role: 'shape' });
    expect(commands[1]).toMatchObject({ role: 'opaque' });
    expectPointsClose(only(commands, 'hairline')[0]!.points, [
      { x: -20, y: -15 },
      { x: 20, y: -15 },
      { x: 20, y: 15 },
      { x: -20, y: 15 },
      { x: -20, y: -15 },
    ]);
  });
});

describe('circleDrawing (circle_shape_2d.cpp:76-93)', () => {
  it('fills 24 points and outlines them closed with 25', () => {
    const commands = circleDrawing({ radius: 12 });

    expect(only(commands, 'fill')[0]!.points).toHaveLength(24);
    expect(only(commands, 'hairline')[0]!.points).toHaveLength(25);
    expect(only(commands, 'hairline')[0]!.points[24]).toEqual(only(commands, 'fill')[0]!.points[0]);
  });
});

describe('capsuleDrawing (capsule_shape_2d.cpp:103-113)', () => {
  it('fills the 26 points and outlines them closed with 27', () => {
    const commands = capsuleDrawing({ radius: 10, height: 40 });

    expect(only(commands, 'fill')[0]!.points).toHaveLength(26);
    expect(only(commands, 'hairline')[0]!.points).toHaveLength(27);
  });
});

describe('segmentDrawing (segment_shape_2d.cpp:74-76)', () => {
  it('draws one 3 px line from a to b in the shape colour', () => {
    expect(segmentDrawing({ a: { x: 1, y: 2 }, b: { x: 30, y: 40 } })).toEqual([
      {
        kind: 'stroke',
        points: [
          { x: 1, y: 2 },
          { x: 30, y: 40 },
        ],
        width: 3,
        roles: ['shape', 'shape'],
      },
    ]);
  });
});

describe('convexPolygonDrawing (convex_polygon_shape_2d.cpp:104-118)', () => {
  const triangle = [
    { x: -30, y: 20 },
    { x: 30, y: 20 },
    { x: 0, y: -30 },
  ];

  it('fills the polygon, then outlines it opaque back to the first point', () => {
    const commands = convexPolygonDrawing({ points: triangle });

    expect(commands.map((c) => c.kind)).toEqual(['fill', 'hairline']);
    expect(only(commands, 'hairline')[0]).toMatchObject({ role: 'opaque' });
    expectPointsClose(only(commands, 'hairline')[0]!.points, [...triangle, triangle[0]!]);
  });

  it('draws nothing for fewer than three points (edge case)', () => {
    expect(convexPolygonDrawing({ points: triangle.slice(0, 2) })).toEqual([]);
  });
});

describe('concavePolygonDrawing (concave_polygon_shape_2d.cpp:64-75)', () => {
  const segments = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ];

  it('draws one 2 px line for each pair of points', () => {
    const commands = concavePolygonDrawing({ segments });

    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({
      kind: 'stroke',
      points: [segments[2], segments[3]],
      width: 2,
      roles: ['shape', 'shape'],
    });
  });

  it('draws nothing for an odd number of points (edge case)', () => {
    expect(concavePolygonDrawing({ segments: segments.slice(0, 3) })).toEqual([]);
  });

  it('draws nothing for no segments (edge case)', () => {
    expect(concavePolygonDrawing({ segments: [] })).toEqual([]);
  });
});

describe('worldBoundaryDrawing (world_boundary_shape_2d.cpp:88-127)', () => {
  const commands = worldBoundaryDrawing({ normal: { x: 0, y: -1 }, distance: 0 });
  const [line, arrow] = only(commands, 'stroke');

  it('draws a 3 px line along the boundary, clear at both ends and 100 px out', () => {
    expect(commands).toHaveLength(2);
    expect(line!.width).toBe(3);
    expect(line!.roles).toEqual(['clear', 'shape', 'shape', 'clear']);
    expectPointsClose(line!.points, [
      { x: 100, y: 0 },
      { x: 60, y: 0 },
      { x: -60, y: 0 },
      { x: -100, y: 0 },
    ]);
  });

  it('draws a 1.5 px arrow along the normal in the inverted colour', () => {
    expect(arrow!.width).toBe(1.5);
    expect(arrow!.roles).toEqual(Array(7).fill('inverted'));
    expectPointsClose(arrow!.points, [
      { x: -2.5, y: -1.5 },
      { x: -2.5, y: -20 },
      { x: -10, y: -20 },
      { x: 0, y: -40 },
      { x: 10, y: -20 },
      { x: 2.5, y: -20 },
      { x: 2.5, y: -1.5 },
    ]);
  });

  it('moves the line and the arrow along the normal by the distance (edge case)', () => {
    const [moved] = only(worldBoundaryDrawing({ normal: { x: 0, y: -1 }, distance: 30 }), 'stroke');

    expect(moved!.points[1]!.y).toBeCloseTo(-30, 5);
  });
});

describe('separationRayDrawing (separation_ray_shape_2d.cpp:44-71)', () => {
  it('draws a 1.4 px line to where a 6 px arrow head begins, then the head, for length 20', () => {
    const commands = separationRayDrawing({ length: 20 });

    expect(commands.map((c) => c.kind)).toEqual(['stroke', 'fill']);
    expect(only(commands, 'stroke')[0]).toMatchObject({ width: 1.4, roles: ['shape', 'shape'] });
    expectPointsClose(only(commands, 'stroke')[0]!.points, [
      { x: 0, y: 0 },
      { x: 0, y: 14 },
    ]);
    expectPointsClose(only(commands, 'fill')[0]!.points, [
      { x: 0, y: 20 },
      { x: -3, y: 14 },
      { x: 3, y: 14 },
    ]);
  });

  it('shortens the head to two thirds of the length for a length of 6 (edge case)', () => {
    const commands = separationRayDrawing({ length: 6 });

    expectPointsClose(only(commands, 'stroke')[0]!.points, [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]);
  });

  it('draws only the head, the whole length, when the length is under the line width (edge case)', () => {
    const commands = separationRayDrawing({ length: 1 });

    expect(commands.map((c) => c.kind)).toEqual(['fill']);
    expectPointsClose(only(commands, 'fill')[0]!.points, [
      { x: 0, y: 1 },
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
    ]);
  });
});
