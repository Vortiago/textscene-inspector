import { describe, expect, it } from 'vitest';
import { triangulatePolygon } from './triangulate';

describe('triangulatePolygon (Geometry2D::triangulate_polygon)', () => {
  it('gives two triangles for a square, whichever way it winds', () => {
    const square = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ];
    expect(triangulatePolygon(square)).toHaveLength(6);
    expect(triangulatePolygon([...square].reverse())).toHaveLength(6);
  });

  it('gives one triangle for three points', () => {
    expect(
      triangulatePolygon([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ])
    ).toHaveLength(3);
  });

  // Measured in Godot 4.6.3: the vertices of a PolygonOccluder3D with these points are cleared.
  it.each([
    [
      'fewer than three points',
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
      ],
    ],
    [
      'a bow tie, whose edges cross',
      [
        { x: 1, y: 1 },
        { x: 5, y: 4 },
        { x: 5, y: 1 },
        { x: 1, y: 4 },
      ],
    ],
  ])('gives nothing for %s', (_label, polygon) => {
    expect(triangulatePolygon(polygon)).toEqual([]);
  });

  // Measured in Godot 4.6.3: three collinear points keep their three vertices, so they triangulate.
  it('gives one flat triangle for three collinear points', () => {
    expect(
      triangulatePolygon([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ])
    ).toHaveLength(3);
  });
});
