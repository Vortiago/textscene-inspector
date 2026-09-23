/** Tests for `useCameraDeepLink`, the read-only `?camera=` deep link. */
import { describe, expect, it, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCameraDeepLink } from './useCameraDeepLink';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useCameraDeepLink', () => {
  it('returns the ?camera= node path when present', () => {
    window.history.replaceState(null, '', '/?fixture=x.tscn&camera=Root/Camera3D');
    const { result } = renderHook(() => useCameraDeepLink());
    expect(result.current).toBe('Root/Camera3D');
  });

  it('returns null when no ?camera= param is present', () => {
    window.history.replaceState(null, '', '/?fixture=x.tscn');
    const { result } = renderHook(() => useCameraDeepLink());
    expect(result.current).toBeNull();
  });

  it('treats a blank ?camera= value as absent', () => {
    window.history.replaceState(null, '', '/?camera=%20%20');
    const { result } = renderHook(() => useCameraDeepLink());
    expect(result.current).toBeNull();
  });

  it('is read once at mount and does not change on rerender', () => {
    window.history.replaceState(null, '', '/?camera=Root/Camera3D');
    const { result, rerender } = renderHook(() => useCameraDeepLink());
    expect(result.current).toBe('Root/Camera3D');
    // A later URL change must not retroactively move the mounted view.
    window.history.replaceState(null, '', '/?camera=Root/Other');
    rerender();
    expect(result.current).toBe('Root/Camera3D');
  });
});
