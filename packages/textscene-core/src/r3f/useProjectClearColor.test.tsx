/** The project clear colour every opaque viewport clears to. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useProjectClearColor, useProjectClearColorSrgb } from './useProjectClearColor';
import { DEFAULT_CLEAR_COLOR } from '../godot/rendering';

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

describe('useProjectClearColorSrgb', () => {
  it("is Godot's default clear colour, unconverted, with no project setting", () => {
    const { result } = renderHook(() => useProjectClearColorSrgb());
    expect(result.current).toEqual(DEFAULT_CLEAR_COLOR);
  });

  it('keeps its identity across renders', () => {
    const { result, rerender } = renderHook(() => useProjectClearColorSrgb());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
