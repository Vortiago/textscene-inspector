import { describe, expect, it } from 'vitest';
import { godotPolylineToSegments } from './godotPolylineToSegments';

const SQUARE = [0, 0, 16, 0, 16, 16, 0, 16];

describe('godotPolylineToSegments', () => {
  it('returns null for fewer than 2 points', () => {
    expect(godotPolylineToSegments([], true)).toBeNull();
    expect(godotPolylineToSegments([0, 0], true)).toBeNull();
  });

  it('closes a polygon with a segment from the last point back to the first', () => {
    const segments = godotPolylineToSegments([0, 0, 16, 0], true);
    expect(Array.from(segments!)).toEqual([0, 0, 0, 16, 0, 0, 16, 0, 0, 0, 0, 0]);
  });

  it('draws N segments for a closed polygon and N-1 for an open chain', () => {
    expect(godotPolylineToSegments(SQUARE, true)!.length).toBe(4 * 2 * 3);
    expect(godotPolylineToSegments(SQUARE, false)!.length).toBe(3 * 2 * 3);
  });

  it('negates y, Godot y-down to three y-up, and keeps a zero y at +0', () => {
    const segments = godotPolylineToSegments([0, 10, 10, 0], false)!;
    expect(Array.from(segments)).toEqual([0, -10, 0, 10, 0, 0]);
    expect(Object.is(segments[4], 0)).toBe(true);
  });

  it('ignores a dangling odd coordinate', () => {
    const segments = godotPolylineToSegments([0, 0, 5, 5, 9], false)!;
    expect(Array.from(segments)).toEqual([0, 0, 0, 5, -5, 0]);
  });
});
