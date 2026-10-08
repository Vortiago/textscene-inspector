import { describe, expect, it } from 'vitest';
import { rect2Intersection, rect2Intersects } from './rect2';

const SQUARE = { x: 0, y: 0, w: 10, h: 10 };

describe('rect2Intersects', () => {
  it('is true for rects that overlap', () => {
    expect(rect2Intersects(SQUARE, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('is false for rects that only touch, as borders do not count', () => {
    expect(rect2Intersects(SQUARE, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(rect2Intersects(SQUARE, { x: 0, y: -5, w: 5, h: 5 })).toBe(false);
  });

  it('is false for an inverted rect, which an empty bounding box gives', () => {
    const empty = { x: Infinity, y: Infinity, w: -Infinity, h: -Infinity };
    expect(rect2Intersects(SQUARE, empty)).toBe(false);
    expect(rect2Intersects(empty, SQUARE)).toBe(false);
  });
});

describe('rect2Intersection', () => {
  it('returns the overlap', () => {
    expect(rect2Intersection(SQUARE, { x: 4, y: 2, w: 10, h: 3 })).toEqual({ x: 4, y: 2, w: 6, h: 3 });
  });

  it('returns the all-zero rect for rects that only touch', () => {
    expect(rect2Intersection(SQUARE, { x: 10, y: 0, w: 5, h: 5 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('returns the all-zero rect for rects that miss', () => {
    expect(rect2Intersection(SQUARE, { x: 50, y: 50, w: 10, h: 10 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('returns the inner rect when one holds the other', () => {
    const inner = { x: 2, y: 3, w: 4, h: 5 };
    expect(rect2Intersection(SQUARE, inner)).toEqual(inner);
  });
});
