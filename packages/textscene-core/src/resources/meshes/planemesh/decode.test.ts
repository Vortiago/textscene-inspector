/**
 * Tests for the PlaneMesh decode.
 *
 * Defaults from Godot `primitive_meshes.h:252-256`: `size = Size2(2, 2)`,
 * `subdivide_w/d = 0`, `center_offset` zero, `orientation = FACE_Y` (1).
 * `set_subdivide_width` / `_depth` (`primitive_meshes.cpp:1539-1561`) floor at 0
 * (`p_divisions > 0 ? p_divisions : 0`), so a negative subdivision is a flat 0
 * rather than a negative segment count three.js cannot build.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodePlaneMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodePlaneMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodePlaneMesh({})).toEqual({
      size: { x: 2, y: 2 },
      subdivideWidth: 0,
      subdivideDepth: 0,
      orientation: 1,
      centerOffset: undefined,
      flipFaces: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    expect(
      decodePlaneMesh({
        size: 'Vector2(4, 8)',
        subdivide_width: '2',
        subdivide_depth: '3',
        orientation: '0',
        center_offset: 'Vector3(1, 2, 3)',
        flip_faces: 'true',
      })
    ).toEqual({
      size: { x: 4, y: 8 },
      subdivideWidth: 2,
      subdivideDepth: 3,
      orientation: 0,
      centerOffset: { x: 1, y: 2, z: 3 },
      flipFaces: true,
    });
  });

  it('floors a negative subdivision at 0 the way Godot does', () => {
    const p = decodePlaneMesh({ subdivide_width: '-4', subdivide_depth: '-1' });
    expect(p.subdivideWidth).toBe(0);
    expect(p.subdivideDepth).toBe(0);
  });

  it('falls back to the 2x2 default for a malformed size', () => {
    expect(decodePlaneMesh({ size: 'not-a-vector' }).size).toEqual({ x: 2, y: 2 });
    expect(decodePlaneMesh({ size: 'Vector2(--1, 2)' }).size).toEqual({ x: 2, y: 2 });
  });

  it('warns then leaves center_offset unset for a malformed vector', () => {
    expect(decodePlaneMesh({ center_offset: 'Vector3(1, 2)' }).centerOffset).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to FACE_Y (1) for an orientation outside the enum', () => {
    expect(decodePlaneMesh({ orientation: '7' }).orientation).toBe(1);
    expect(decodePlaneMesh({ orientation: 'foo' }).orientation).toBe(1);
  });

  it('honours a caller-supplied default set (the QuadMesh subclass path)', () => {
    const p = decodePlaneMesh({}, { size: { x: 1, y: 1 }, orientation: 2 });
    expect(p.size).toEqual({ x: 1, y: 1 });
    expect(p.orientation).toBe(2);
  });
});
