/**
 * Multi-pointer gesture geometry. Not Godot maths — Godot's editor has no
 * touch scheme (ADR-0029) — so these live apart from `godotEditorCursor.ts`
 * and are shared by both viewports.
 */
import { describe, expect, it } from 'vitest';
import {
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
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
    // Deliberately NOT pre-inverted: 3D divides by this (a spreading pinch
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
