/**
 * TorusMesh build. Godot resolves the radius pair at surface build
 * (`primitive_meshes.cpp:2232-2239`): equal radii build no surface, and a reversed pair is swapped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { buildTorusMeshSurface } from './build';
import { expectClockwiseFronts, expectClose, vertexOf } from '../primitivemesh/surface.testkit';
import type { TorusMeshProperties } from './types';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

/** Four rings round the axis of four segments each: a row of five vertices per ring step. */
const COARSE: TorusMeshProperties = { innerRadius: 0.5, outerRadius: 1, rings: 4, ringSegments: 4 };

describe('buildTorusMeshSurface', () => {
  it('builds (rings + 1) rows of (ring_segments + 1) vertices', () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expect(surface.positions.length / 3).toBe(25);
    expect(surface.indices.length).toBe(4 * 4 * 6);
  });

  it('starts on the inner edge at -Z, facing the axis, its tangent along -X', () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expectClose(vertexOf(surface.positions, 0), [0, 0, -0.5]);
    expectClose(vertexOf(surface.normals, 0), [0, 0, 1]);
    expectClose(vertexOf(surface.tangents, 0, 4), [-1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, 0, 2), [0, 0]);
  });

  it('runs V round the tube, over the top first', () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expectClose(vertexOf(surface.positions, 1), [0, 0.25, -0.75]);
    expectClose(vertexOf(surface.normals, 1), [0, 1, 0]);
    expectClose(vertexOf(surface.uvs, 1, 2), [0, 0.25]);
  });

  it('runs U round the axis, from -Z towards -X', () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expectClose(vertexOf(surface.positions, 5), [-0.5, 0, 0]);
    expectClose(vertexOf(surface.normals, 5), [1, 0, 0]);
    expectClose(vertexOf(surface.tangents, 5, 4), [0, 0, 1, 1]);
    expectClose(vertexOf(surface.uvs, 6, 2), [0.25, 0.25]);
  });

  it('closes both seams on the first vertex', () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expectClose(vertexOf(surface.positions, 24), [0, 0, -0.5]);
    expectClose(vertexOf(surface.uvs, 24, 2), [1, 1]);
  });

  it("fronts each quad clockwise, Godot's winding", () => {
    const surface = buildTorusMeshSurface(COARSE, null)!;

    expect(Array.from(surface.indices).slice(0, 6)).toEqual([5, 1, 0, 5, 6, 1]);
    expectClockwiseFronts(surface);
  });

  it('builds the same positions from a reversed radius pair', () => {
    const reversed = buildTorusMeshSurface({ ...COARSE, innerRadius: 1, outerRadius: 0.5 }, null)!;

    expect(reversed.positions).toEqual(buildTorusMeshSurface(COARSE, null)!.positions);
  });

  it('builds nothing when the radii are equal, as Godot refuses that mesh', () => {
    expect(buildTorusMeshSurface({ ...COARSE, innerRadius: 1, outerRadius: 1 }, null)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('writes no UV2 without a padding', () => {
    expect(buildTorusMeshSurface(COARSE, null)!.uv2s).toBeUndefined();
  });

  // Godot 4.6.3 writes each expected UV2 for the same properties.
  it('lays UV2 out by length, so the inner edge takes less width than the outer', () => {
    const surface = buildTorusMeshSurface(COARSE, 0)!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.25, 0]);
    expectClose(vertexOf(surface.uv2s, 1, 2), [0.125, 0.25]);
    expectClose(vertexOf(surface.uv2s, 6, 2), [0.3125, 0.25]);
  });

  it('pads UV2 on the right and the bottom', () => {
    const surface = buildTorusMeshSurface(COARSE, Math.PI)!;

    expectClose(vertexOf(surface.uv2s, 1, 2), [0.083333, 0.083333]);
    expectClose(vertexOf(surface.uv2s, 6, 2), [0.208333, 0.083333]);
  });
});
