/**
 * BoxMesh decode. Defaults: `primitive_meshes.h:164-167` (`Vector3(1, 1, 1)`,
 * subdivisions 0). `set_subdivide_width/height/depth` (`primitive_meshes.cpp:999-1035`)
 * floor at 0 (`p_divisions > 0 ? p_divisions : 0`). `set_size` (:985) has no guard,
 * so a negative extent is Godot's own behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeBoxMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeBoxMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeBoxMesh({})).toEqual({
      size: { x: 1, y: 1, z: 1 },
      subdivideWidth: 0,
      subdivideHeight: 0,
      subdivideDepth: 0,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads an authored size and subdivisions', () => {
    expect(
      decodeBoxMesh({
        size: 'Vector3(2, 3, 4)',
        subdivide_width: '1',
        subdivide_height: '2',
        subdivide_depth: '3',
      })
    ).toEqual({
      size: { x: 2, y: 3, z: 4 },
      subdivideWidth: 1,
      subdivideHeight: 2,
      subdivideDepth: 3,
    });
  });

  it('floors negative subdivisions at 0 the way Godot does', () => {
    const p = decodeBoxMesh({
      subdivide_width: '-1',
      subdivide_height: '-2',
      subdivide_depth: '-3',
    });
    expect([p.subdivideWidth, p.subdivideHeight, p.subdivideDepth]).toEqual([0, 0, 0]);
  });

  it('warns then falls back to the unit size for a malformed size', () => {
    expect(decodeBoxMesh({ size: 'Vector3(1, 2)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('reads scientific notation and keeps a negative extent as authored', () => {
    // BoxMesh::set_size has no ERR_FAIL, so Godot stores a negative extent too.
    expect(decodeBoxMesh({ size: 'Vector3(1e-2, -1, 3)' }).size).toEqual({
      x: 0.01,
      y: -1,
      z: 3,
    });
  });
});
