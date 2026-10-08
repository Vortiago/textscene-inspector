/** The project clear colour every opaque viewport clears to. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useProjectClearColor } from './useProjectClearColor';

describe('useProjectClearColor', () => {
  it("is Godot's default sRGB 0.3 grey with no project setting", () => {
    const { result } = renderHook(() => useProjectClearColor());
    expect(result.current.getStyle(THREE.SRGBColorSpace)).toBe('rgb(77,77,77)');
  });

  it('keeps its identity across renders, so a pass that depends on it does not rebuild', () => {
    const { result, rerender } = renderHook(() => useProjectClearColor());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
