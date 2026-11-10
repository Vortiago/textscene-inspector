import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    const first = result.current(true)!;
    const dispose = vi.spyOn(first, 'dispose');
    result.current(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(result.current(true)).not.toBe(first);
  });

  it.each([
    ['width', { width: 16, height: 8, name: 'view' }],
    ['height', { width: 8, height: 16, name: 'view' }],
    ['name', { width: 8, height: 8, name: 'other' }],
  ])('makes a new target and frees the old one once the %s changes', async (_input, changed) => {
    const { result, rerender } = renderHook(
      ({ width, height, name }) => useBackdropTarget(width, height, name, canvasColorSpaceOf(false)),
      { initialProps: { width: 8, height: 8, name: 'view' } }
    );
    const first = result.current(true)!;
    const dispose = vi.spyOn(first, 'dispose');
    rerender(changed);
    expect(result.current(true)).not.toBe(first);
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('frees the target when the viewport unmounts', async () => {
    const { result, unmount } = renderHook(() => useBackdropTarget(8, 8, 'view', canvasColorSpaceOf(false)));
    const dispose = vi.spyOn(result.current(true)!, 'dispose');
    unmount();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
