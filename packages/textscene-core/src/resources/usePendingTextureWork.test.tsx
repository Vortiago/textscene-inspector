/**
 * The React view of the page-wide texture work count, for the status that tells a
 * user, and a capture harness, that textures are still being built or uploaded.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { beginTextureWork } from './textures/textureWork';
import { usePendingTextureWork } from './usePendingTextureWork';

describe('usePendingTextureWork', () => {
  it('follows the count from zero, up, and back to zero', () => {
    const { result } = renderHook(() => usePendingTextureWork());
    expect(result.current).toBe(0);

    let end: () => void = () => {};
    act(() => {
      end = beginTextureWork();
    });
    expect(result.current).toBe(1);

    act(() => end());
    expect(result.current).toBe(0);
  });

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => usePendingTextureWork());
    unmount();
    const end = beginTextureWork();
    expect(result.current).toBe(0);
    end();
  });
});
