/** SegmentShape2D decode: the two end points, with the defaults of `segment_shape_2d.cpp:100-103`. */

import { describe, expect, it } from 'vitest';
import { decodeSegmentShape2D } from './decode';

describe('decodeSegmentShape2D', () => {
  it('honours both end points', () => {
    expect(decodeSegmentShape2D({ a: 'Vector2(-5, 2)', b: 'Vector2(30, 40)' })).toEqual({
      a: { x: -5, y: 2 },
      b: { x: 30, y: 40 },
    });
  });

  it('falls back to a at the origin and b at (0, 10) when absent', () => {
    expect(decodeSegmentShape2D({})).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 } });
  });

  it('keeps one authored end point beside the default of the other', () => {
    expect(decodeSegmentShape2D({ a: 'Vector2(4, 4)' })).toEqual({ a: { x: 4, y: 4 }, b: { x: 0, y: 10 } });
  });
});
