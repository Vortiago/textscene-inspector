/**
 * Tests for the CylinderShape3D decode.
 *
 * Defaults ported from Godot `cylinder_shape_3d.h:39-40`
 * (`float radius = 0.5`, `float height = 2.0`). Unlike CapsuleShape3D the
 * setters are independent — `cylinder_shape_3d.cpp:94` and `:105` assign and
 * update the shape without touching the other property — so a squat cylinder
 * (height < 2 * radius) is legal and must survive the decode unchanged.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeCylinderShape3D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeCylinderShape3D', () => {
  it('honours authored radius and height', () => {
    const result = decodeCylinderShape3D({ radius: '1.5', height: '6' });
    expect(result.radius).toBe(1.5);
    expect(result.height).toBe(6);
  });

  it('falls back to the Godot defaults (0.5 / 2) when both are absent, silently', () => {
    const result = decodeCylinderShape3D({});
    expect(result.radius).toBe(0.5);
    expect(result.height).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const result = decodeCylinderShape3D({ radius: 'nope', height: 'nope' });
    expect(result.radius).toBe(0.5);
    expect(result.height).toBe(2);
    expect(Number.isNaN(result.radius + result.height)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('keeps a squat cylinder as authored — radius and height are not linked', () => {
    const result = decodeCylinderShape3D({ radius: '4', height: '0.5' });
    expect(result.radius).toBe(4);
    expect(result.height).toBe(0.5);
  });

  it('reads one authored property while the other keeps its default', () => {
    expect(decodeCylinderShape3D({ height: '10' })).toEqual({ radius: 0.5, height: 10 });
    expect(decodeCylinderShape3D({ radius: '3' })).toEqual({ radius: 3, height: 2 });
  });
});

describe('decodeCylinderShape3D negative scalars', () => {
  it('refuses a negative radius or height (cylinder_shape_3d.cpp:95 / :106)', () => {
    expect(decodeCylinderShape3D({ radius: '-1', height: '6' })).toEqual({
      radius: 0.5,
      height: 6,
    });
    expect(decodeCylinderShape3D({ radius: '2', height: '-6' })).toEqual({
      radius: 2,
      height: 2,
    });
    expect(warnSpy).toHaveBeenCalled();
  });
});
