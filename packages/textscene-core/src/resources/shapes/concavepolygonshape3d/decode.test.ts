/** Tests for the ConcavePolygonShape3D decode. */

import { describe, expect, it } from 'vitest';
import { decodeConcavePolygonShape3D } from './decode';

describe('decodeConcavePolygonShape3D', () => {
  it('parses a triangle soup', () => {
    const data = decodeConcavePolygonShape3D({
      data: 'PackedVector3Array(0,0,0, 1,0,0, 0,1,0)',
    }).data;
    expect(data.length).toBe(9);
    expect(data.length % 9).toBe(0); // whole triangles
  });

  it('yields empty data when the property is absent', () => {
    expect(decodeConcavePolygonShape3D({}).data.length).toBe(0);
  });

  it('degrades to empty data (no throw) on malformed data', () => {
    expect(() =>
      decodeConcavePolygonShape3D({ data: 'PackedVector3Array(0, 0, nope)' })
    ).not.toThrow();
    expect(decodeConcavePolygonShape3D({ data: 'not-an-array' }).data.length).toBe(0);
  });
});
