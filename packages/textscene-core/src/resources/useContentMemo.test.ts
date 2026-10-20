import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../parser/types';
import { useContentMemo } from './useContentMemo';

const box = (size: string): TscnInternalResource => ({ id: 'b', type: 'BoxMesh', data: { size } });

function renderMemo(initial: TscnInternalResource | null) {
  const build = vi.fn((resource: TscnInternalResource) => ({ size: resource.data['size'] }));
  const hook = renderHook(({ resource }) => useContentMemo(resource, build), {
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

describe('useContentMemo with dependencies', () => {
  it('builds again when a dependency changes under the same content', () => {
    const resource = box('Vector3(1, 1, 1)');
    const { result, rerender } = renderHook(
      ({ scale }) => useContentMemo(resource, (r) => `${r.data['size']} x${scale}`, [scale]),
      { initialProps: { scale: 1 } }
    );
    rerender({ scale: 2 });
    expect(result.current).toBe('Vector3(1, 1, 1) x2');
  });
});
