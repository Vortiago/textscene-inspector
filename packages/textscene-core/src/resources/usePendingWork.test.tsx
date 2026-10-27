/** The React view of a page-wide work count, for the statuses a capture harness waits on. */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { textureWork } from './textures/textureWork';
import { usePendingWork } from './usePendingWork';

describe('usePendingWork', () => {
  it('follows the count from zero, up, and back to zero', () => {
    const { result } = renderHook(() => usePendingWork(textureWork));
    expect(result.current).toBe(0);

    let end: () => void = () => {};
    act(() => {
      end = textureWork.begin();
    });
    expect(result.current).toBe(1);

    act(() => end());
    expect(result.current).toBe(0);
  });

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => usePendingWork(textureWork));
    unmount();
    const end = textureWork.begin();
    expect(result.current).toBe(0);
    end();
  });
});
