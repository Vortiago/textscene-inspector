/** Browser pointer input reduced to numbers a camera can use: gesture geometry and wheel-delta normalisation. */
import { describe, expect, it } from 'vitest';
import {
  clampWheelNotches,
  isGesturePointer,
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  wheelDeltaPixels,
  wheelNotches,
  WHEEL_MAX_NOTCHES,
} from './pointerGesture';

describe('resolveTouchMode', () => {
  it('orbits on one finger and pans on two', () => {
    expect(resolveTouchMode(1)).toBe('orbit');
    expect(resolveTouchMode(2)).toBe('pan');
  });

  it('claims nothing for no fingers or for three and up', () => {
    expect(resolveTouchMode(0)).toBeNull();
    expect(resolveTouchMode(3)).toBeNull();
  });
});

describe('touchCentroid / touchSpan', () => {
  it('takes the midpoint and the separation of two fingers', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ];
    expect(touchCentroid(points)).toEqual({ x: 5, y: 10 });
    expect(touchSpan(points)).toBeCloseTo(Math.hypot(10, 20), 9);
  });

  it('reports a single finger as its own centroid with no span', () => {
    expect(touchCentroid([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9 });
    expect(touchSpan([{ x: 7, y: 9 }])).toBe(0);
  });

  it('survives an empty pointer set', () => {
    expect(touchCentroid([])).toEqual({ x: 0, y: 0 });
    expect(touchSpan([])).toBe(0);
  });
});

describe('pinchSpanRatio', () => {
  it('reports how far the fingers spread, direction-free', () => {
    // Not pre-inverted: 3D divides by this (a spreading pinch
    // shrinks the orbit radius) while 2D multiplies by it (a CSS scale grows),
    // and each call site should show which way it goes.
    expect(pinchSpanRatio(100, 200)).toBeCloseTo(2, 9);
    expect(pinchSpanRatio(200, 100)).toBeCloseTo(0.5, 9);
  });

  it('is a no-op for a degenerate span rather than dividing by zero', () => {
    expect(pinchSpanRatio(0, 100)).toBe(1);
    expect(pinchSpanRatio(100, 0)).toBe(1);
  });
});

describe('wheelDeltaPixels', () => {
  it('passes pixel-mode deltas through on both axes', () => {
    expect(wheelDeltaPixels({ deltaX: -12, deltaY: 34 })).toEqual({ dx: -12, dy: 34 });
  });

  it('scales line and page modes to the same pixel distance', () => {
    expect(wheelDeltaPixels({ deltaY: 3, deltaMode: 1 }).dy).toBeCloseTo(100, 9);
    expect(wheelDeltaPixels({ deltaY: 1, deltaMode: 2 }).dy).toBeCloseTo(100, 9);
  });

  it('defaults a missing horizontal axis to zero', () => {
    expect(wheelDeltaPixels({ deltaY: 5 }).dx).toBe(0);
  });
});

describe('wheelNotches', () => {
  it('reads one Chrome notch — 100 pixels — as exactly one notch', () => {
    expect(wheelNotches({ deltaY: 100 })).toBeCloseTo(1, 9);
    expect(wheelNotches({ deltaY: -100 })).toBeCloseTo(-1, 9);
  });

  it('reads one notch the same in line and page mode', () => {
    // Three lines to a notch (Firefox), one page to a notch. Getting either
    // wrong is a silent cross-browser divergence in how far a scroll zooms.
    expect(wheelNotches({ deltaY: 3, deltaMode: 1 })).toBeCloseTo(1, 9);
    expect(wheelNotches({ deltaY: 1, deltaMode: 2 })).toBeCloseTo(1, 9);
  });

  it('reports a trackpad’s small delta as a fraction of a notch', () => {
    expect(wheelNotches({ deltaY: 10 })).toBeCloseTo(0.1, 9);
  });

  it('is zero for a zero delta, and ignores the horizontal axis', () => {
    expect(wheelNotches({ deltaY: 0 })).toBe(0);
    expect(wheelNotches({ deltaX: 500, deltaY: 0 })).toBe(0);
  });
});

describe('clampWheelNotches', () => {
  it('passes an ordinary notch count through untouched', () => {
    expect(clampWheelNotches(0)).toBe(0);
    expect(clampWheelNotches(1)).toBe(1);
    expect(clampWheelNotches(-0.25)).toBe(-0.25);
  });

  it('caps a kinetic fling in both directions', () => {
    expect(clampWheelNotches(1000)).toBe(WHEEL_MAX_NOTCHES);
    expect(clampWheelNotches(-1000)).toBe(-WHEEL_MAX_NOTCHES);
  });
});

describe('isGesturePointer', () => {
  it('claims touch and pen', () => {
    expect(isGesturePointer('touch')).toBe(true);
    // A stylus is the device class touch exists for; routed to the mouse path
    // it is inert, since pen-drag is button 0 with no modifiers.
    expect(isGesturePointer('pen')).toBe(true);
  });

  it('leaves a mouse on the button/modifier path', () => {
    expect(isGesturePointer('mouse')).toBe(false);
    expect(isGesturePointer('')).toBe(false);
  });
});
