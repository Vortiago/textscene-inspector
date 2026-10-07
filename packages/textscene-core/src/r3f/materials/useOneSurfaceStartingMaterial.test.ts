/**
 * The starting material of a draw that owns one surface: every draw group hidden until the
 * owned surface's slot attaches, and three's default material for a one-surface mesh.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOneSurfaceStartingMaterial } from './useOneSurfaceStartingMaterial';

describe('useOneSurfaceStartingMaterial', () => {
  it('hides every draw group of a multi-surface mesh', () => {
    const { result } = renderHook(() => useOneSurfaceStartingMaterial(3));
    expect(result.current).toHaveLength(3);
    expect(result.current!.every((m) => m.visible === false)).toBe(true);
  });

  it('gives a one-surface mesh no starting material', () => {
    const { result } = renderHook(() => useOneSurfaceStartingMaterial(1));
    expect(result.current).toBeUndefined();
  });

  it('gives each draw its own array, as each slot attaches into its own', () => {
    const first = renderHook(() => useOneSurfaceStartingMaterial(2)).result.current;
    const second = renderHook(() => useOneSurfaceStartingMaterial(2)).result.current;
    expect(first).not.toBe(second);
  });
});
