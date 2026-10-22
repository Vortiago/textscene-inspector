import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../parser/types';
import { resourceContentKey } from './resourceContentKey';
import { useContentMemo } from './useContentMemo';

const box = (size: string): TscnInternalResource => ({ id: 'b', type: 'BoxMesh', data: { size } });

function renderMemo(initial: TscnInternalResource | null) {
  const build = vi.fn((resource: TscnInternalResource) => ({ size: resource.data['size'] }));
  const hook = renderHook(({ resource }) => useContentMemo(resource, resourceContentKey, build), {
    initialProps: { resource: initial },
  });
  return { ...hook, build };
}

describe('useContentMemo', () => {
  it('keeps what it built while a fresh resource holds the same content', () => {
    const { result, rerender, build } = renderMemo(box('Vector3(1, 1, 1)'));
    const first = result.current;
    rerender({ resource: box('Vector3(1, 1, 1)') });
    expect(result.current).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('builds again when the content changes', () => {
    const { result, rerender } = renderMemo(box('Vector3(1, 1, 1)'));
    rerender({ resource: box('Vector3(2, 2, 2)') });
    expect(result.current).toEqual({ size: 'Vector3(2, 2, 2)' });
  });

  it('is null for no resource, and builds nothing', () => {
    const { result, build } = renderMemo(null);
    expect(result.current).toBeNull();
    expect(build).not.toHaveBeenCalled();
  });
});

describe('useContentMemo over another input', () => {
  it('keeps what it built while the key holds, and builds again when it changes', () => {
    const build = vi.fn((input: { id: string; body: string }) => ({ built: input.body }));
    const { result, rerender } = renderHook(({ input }) => useContentMemo(input, (i) => i.body, build), {
      initialProps: { input: { id: 'a', body: 'x' } },
    });
    const first = result.current;

    rerender({ input: { id: 'b', body: 'x' } });
    expect(result.current).toBe(first);

    rerender({ input: { id: 'b', body: 'y' } });
    expect(result.current).toEqual({ built: 'y' });
    expect(build).toHaveBeenCalledTimes(2);
  });
});
