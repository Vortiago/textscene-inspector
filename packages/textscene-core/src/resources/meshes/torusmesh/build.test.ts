/**
 * Tests for the TorusMesh geometry build.
 *
 * Godot resolves the radius pair when it builds the surface, not when it stores
 * it (`primitive_meshes.cpp:2232-2241`): equal radii ERR_FAIL the whole mesh
 * array (nothing is drawn) and a swapped pair is SWAPped before use. Handing the
 * raw pair to three's TorusGeometry instead yields a NEGATIVE tube radius, which
 * renders an inside-out ring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { buildTorusMeshGeometry } from './build';
import type { TorusMeshProperties } from './types';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

function torus(overrides: Partial<TorusMeshProperties> = {}): TorusMeshProperties {
  return { innerRadius: 0.5, outerRadius: 1, rings: 64, ringSegments: 32, ...overrides };
}

const params = (g: object) => (g as { parameters: Record<string, number> }).parameters;

describe('buildTorusMeshGeometry', () => {
  it('maps the Godot radius pair to three centre + tube radius', () => {
    const geometry = buildTorusMeshGeometry(torus());

    expect(params(geometry!).radius).toBeCloseTo(0.75, 6);
    expect(params(geometry!).tube).toBeCloseTo(0.25, 6);
  });

  it('swaps a reversed radius pair instead of building a negative tube', () => {
    const geometry = buildTorusMeshGeometry(torus({ innerRadius: 1, outerRadius: 0.5 }));

    expect(params(geometry!).radius).toBeCloseTo(0.75, 6);
    expect(params(geometry!).tube).toBeCloseTo(0.25, 6);
  });

  it('builds nothing when the radii are equal, as Godot ERR_FAILs that mesh', () => {
    expect(buildTorusMeshGeometry(torus({ innerRadius: 1, outerRadius: 1 }))).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('carries the segment counts through to three', () => {
    const geometry = buildTorusMeshGeometry(torus({ rings: 12, ringSegments: 6 }));

    expect(params(geometry!).radialSegments).toBe(6);
    expect(params(geometry!).tubularSegments).toBe(12);
  });
});
