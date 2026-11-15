/**
 * The highlight boxes and the animation binding measure what a node draws, so a resource file that
 * loads moves their counter, though it builds no new live tree.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { useDrawnContentVersion } from './useCacheVersion';
import type { ResourceLoader } from './ResourceLoader';

describe('useDrawnContentVersion', () => {
  it('moves when a resource file loads', () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useDrawnContentVersion(fake.loader as ResourceLoader));
    const before = result.current;

    act(() => fake.eventBus.emit('resource', 'loaded', 'res://box.tres', {}));

    expect(result.current).toBeGreaterThan(before);
  });
});
