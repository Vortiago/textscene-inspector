import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { canvasColorSpaceOf } from '../../../r3f/canvasColorSpace';
import { useBackdropTarget } from './useBackdropTarget';

describe('useBackdropTarget', () => {
  it('answers null while the backdrop is not wanted', () => {
    const { result } = renderHook(() => useBackdropTarget(8, 8, 'view', canvasColorSpaceOf(false)));
    expect(result.current(false)).toBeNull();
  });

  it('keeps one target across draws of the same inputs', () => {
    const { result } = renderHook(() => useBackdropTarget(8, 8, 'view', canvasColorSpaceOf(false)));
    expect(result.current(true)).toBe(result.current(true));
  });

  it('makes a new target for the same draw call once the canvas space changes', () => {
    const { result, rerender } = renderHook(
      ({ isLinear }: { isLinear: boolean }) => useBackdropTarget(8, 8, 'view', canvasColorSpaceOf(isLinear)),
      { initialProps: { isLinear: false } }
    );
    const srgb = result.current(true)!;
    rerender({ isLinear: true });
    const linear = result.current(true)!;
    expect(linear).not.toBe(srgb);
    expect(linear.texture.internalFormat).toBe('RGBA16F');
  });

  it('frees the target when the backdrop stops being wanted', () => {
    const { result } = renderHook(() => useBackdropTarget(8, 8, 'view', canvasColorSpaceOf(false)));
    const first = result.current(true);
    result.current(false);
    expect(result.current(true)).not.toBe(first);
  });
});
