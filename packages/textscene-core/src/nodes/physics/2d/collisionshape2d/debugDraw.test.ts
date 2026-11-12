/**
 * What a CollisionShape2D adds to its shape's drawing (`collision_shape_2d.cpp:98-127`): the grey
 * of a disabled shape, and the arrow of one-way collision.
 */
import { describe, expect, it } from 'vitest';
import { drawColour, oneWayArrowColour, ONE_WAY_ARROW } from './debugDraw';

const TEAL = { r: 0, g: 0.6, b: 0.7, a: 0.42 };

describe('drawColour', () => {
  it('is the debug colour for an enabled shape', () => {
    expect(drawColour(TEAL, false)).toEqual(TEAL);
  });

  it('is the value of the debug colour as a grey at half the alpha for a disabled shape (:98-105)', () => {
    const grey = drawColour(TEAL, true);

    expect(grey.r).toBeCloseTo(0.7, 9);
    expect(grey.g).toBeCloseTo(0.7, 9);
    expect(grey.b).toBeCloseTo(0.7, 9);
    expect(grey.a).toBeCloseTo(0.21, 9);
  });
});

describe('oneWayArrowColour', () => {
  it('is the debug colour inverted, with its alpha (:113)', () => {
    const arrow = oneWayArrowColour(TEAL, false);

    expect(arrow.r).toBeCloseTo(1, 9);
    expect(arrow.g).toBeCloseTo(0.4, 9);
    expect(arrow.b).toBeCloseTo(0.3, 9);
    expect(arrow.a).toBeCloseTo(0.42, 9);
  });

  it('is darkened by a quarter, alpha kept, for a disabled shape (:114-116)', () => {
    const arrow = oneWayArrowColour(TEAL, true);

    expect(arrow.r).toBeCloseTo(0.75, 9);
    expect(arrow.g).toBeCloseTo(0.3, 9);
    expect(arrow.b).toBeCloseTo(0.225, 9);
    expect(arrow.a).toBeCloseTo(0.42, 9);
  });
});

describe('ONE_WAY_ARROW', () => {
  it('is a 2 px line down to y 20, and a head of 8 px below it', () => {
    const [line, head] = ONE_WAY_ARROW;

    expect(line).toMatchObject({
      kind: 'stroke',
      width: 2,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
      ],
    });
    if (head?.kind !== 'fill') throw new Error('expected the head to be a fill');
    expect(head.points[0]).toEqual({ x: 0, y: 28 });
    expect(head.points[1]!.x).toBeCloseTo(5.657, 3);
    expect(head.points[1]!.y).toBe(20);
    expect(head.points[2]!.x).toBeCloseTo(-5.657, 3);
  });
});
