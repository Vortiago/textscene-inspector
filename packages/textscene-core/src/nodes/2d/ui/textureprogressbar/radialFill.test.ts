/**
 * `radialFill.ts` against Godot 4.6.3 (`texture_progress_bar.cpp:181-256,483-524`). `unitValToUv`
 * is worked by hand at the four cardinal angles around `center = (0.5, 0.5)`: 0 top, 0.25 right,
 * 0.5 bottom, 0.75 left, a clockwise sweep from 12 o'clock.
 */

import { describe, expect, it } from 'vitest';
import {
  radialRelativeCenter,
  unitValToUv,
  radialFillValue,
  radialFillGeometry,
  clampRadialFillDegrees,
  normalizeRadialInitialAngle,
  FILL_CLOCKWISE,
} from './radialFill';

describe('radialRelativeCenter (texture_progress_bar.cpp:245-256)', () => {
  it('centres the offset within the texture and normalises to [0, 1]', () => {
    expect(radialRelativeCenter({ x: 64, y: 16 }, { x: 2, y: 3 })).toEqual({ x: 34 / 64, y: 11 / 16 });
  });

  it('clamps an offset that pushes the centre outside the texture', () => {
    expect(radialRelativeCenter({ x: 10, y: 10 }, { x: 100, y: 100 })).toEqual({ x: 1, y: 1 });
  });

  it('is the origin for an invalid (zero-size) texture (progress.is_null() guard, :246-248)', () => {
    expect(radialRelativeCenter({ x: 0, y: 0 }, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });
});

const CENTER = { x: 0.5, y: 0.5 };

describe('unitValToUv (texture_progress_bar.cpp:181-224)', () => {
  it('0 -> top-centre (0.5, 0)', () => {
    const uv = unitValToUv(0, CENTER);
    expect(uv.x).toBeCloseTo(0.5, 9);
    expect(uv.y).toBeCloseTo(0, 9);
  });

  it('0.25 -> right-centre (1, 0.5)', () => {
    const uv = unitValToUv(0.25, CENTER);
    expect(uv.x).toBeCloseTo(1, 9);
    expect(uv.y).toBeCloseTo(0.5, 9);
  });

  it('0.5 -> bottom-centre (0.5, 1)', () => {
    const uv = unitValToUv(0.5, CENTER);
    expect(uv.x).toBeCloseTo(0.5, 9);
    expect(uv.y).toBeCloseTo(1, 9);
  });

  it('0.75 -> left-centre (0, 0.5)', () => {
    const uv = unitValToUv(0.75, CENTER);
    expect(uv.x).toBeCloseTo(0, 9);
    expect(uv.y).toBeCloseTo(0.5, 9);
  });
});

describe('radialFillValue (texture_progress_bar.cpp:483)', () => {
  it('is ratio * degrees / 360', () => {
    expect(radialFillValue(0.5, 360)).toBeCloseTo(0.5, 9);
    expect(radialFillValue(1, 270)).toBeCloseTo(0.75, 9);
  });
});

describe('radialFillGeometry (texture_progress_bar.cpp:483-524)', () => {
  it('a quarter turn (top to right) fans two triangles around the appended centre', () => {
    const geometry = radialFillGeometry(FILL_CLOCKWISE, 0.25, 0, CENTER, { x: 100, y: 100 }, { x: 0, y: 0 });
    expect(geometry).not.toBeNull();
    const { positions, uvs, indices } = geometry!;
    // Boundary: top (50,0), the 45° corner (100,0), right (100,50); centre (50,50) appended last.
    expect(positions.slice(0, 3)).toEqual([50, 0, 0]);
    expect(positions[3]).toBeCloseTo(100, 6);
    expect(positions[4]).toBeCloseTo(0, 6);
    expect(positions.slice(6, 9)).toEqual([100, 50, 0]);
    expect(positions.slice(9, 12)).toEqual([50, 50, 0]);
    // v = 1 - uv.y (three's bottom-up convention).
    expect(uvs.slice(0, 2)).toEqual([0.5, 1]);
    expect(uvs.slice(-2)).toEqual([0.5, 0.5]);
    expect(indices).toEqual([3, 0, 1, 3, 1, 2]);
  });

  it('is null when the boundary walk collapses to a single point (points.size() >= 2 guard, :518)', () => {
    expect(radialFillGeometry(FILL_CLOCKWISE, 0, 0, CENTER, { x: 100, y: 100 }, { x: 0, y: 0 })).toBeNull();
  });
});

describe('clampRadialFillDegrees (set_fill_degrees, texture_progress_bar.cpp:610-619)', () => {
  it('passes an in-range value through', () => {
    expect(clampRadialFillDegrees(180)).toBe(180);
  });

  it('CLAMPs anything outside [0, 360] rather than refusing it', () => {
    expect(clampRadialFillDegrees(400)).toBe(360);
    expect(clampRadialFillDegrees(-10)).toBe(0);
  });

  it('defaults to 360 (texture_progress_bar.h:108) when absent or non-finite', () => {
    expect(clampRadialFillDegrees(undefined)).toBe(360);
    expect(clampRadialFillDegrees(Number.NaN)).toBe(360);
  });
});

describe('normalizeRadialInitialAngle (set_radial_initial_angle, texture_progress_bar.cpp:591-604)', () => {
  it('passes an in-range value through', () => {
    expect(normalizeRadialInitialAngle(90)).toBe(90);
  });

  it('wraps a value outside [0, 360] with fposmodp rather than refusing it', () => {
    expect(normalizeRadialInitialAngle(370)).toBeCloseTo(10, 9);
    expect(normalizeRadialInitialAngle(-30)).toBeCloseTo(330, 9);
  });

  it('a non-finite value is REFUSED outright (ERR_FAIL_COND_MSG, :592) and falls back to the class default 0', () => {
    expect(normalizeRadialInitialAngle(Number.NaN)).toBe(0);
    expect(normalizeRadialInitialAngle(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('defaults to 0 when absent (texture_progress_bar.h:107)', () => {
    expect(normalizeRadialInitialAngle(undefined)).toBe(0);
  });
});
