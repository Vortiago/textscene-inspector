/**
 * The borrow half of the procedural texture cache: what a mounted consumer
 * pins, and — just as load-bearing — what it must NOT pin.
 *
 * A key pinned for a reference the cache holds nothing for is silent today
 * (`LRUCache.pin` tolerates an absent key) and wrong the moment the pinning
 * walk and the resolving walk disagree about which references are procedural.
 * Resolution and pinning are one operation here so they cannot drift; these
 * tests hold that line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StrictMode, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../parser/types';
import { useProceduralTexture, useProceduralTexturePins } from './useProceduralTexture';
import {
  clearProceduralTextureCache,
  proceduralTextureKey,
} from './textures/proceduralTextureCache';

/**
 * Pin traffic is otherwise invisible — the cache exposes no counter — so the
 * two entry points are wrapped, still calling through to the real cache.
 */
const traffic = vi.hoisted(() => ({ pinned: [] as string[], unpinned: [] as string[] }));

vi.mock('./textures/proceduralTextureCache', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./textures/proceduralTextureCache')>();
  return {
    ...actual,
    pinProceduralTexture: (key: string) => {
      traffic.pinned.push(key);
      actual.pinProceduralTexture(key);
    },
    unpinProceduralTexture: (key: string) => {
      traffic.unpinned.push(key);
      actual.unpinProceduralTexture(key);
    },
  };
});

/**
 * Two gradients plus a sub-resource that is a texture but not a procedural one
 * — the reference form that used to mint a key the cache never held.
 */
function scene(): TscnInternalResource[] {
  return [
    {
      id: 'Gradient_a',
      type: 'Gradient',
      data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' },
    },
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
    },
    {
      id: 'GradientTexture2D_b',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '4', height: '4' },
    },
    { id: 'ImageTexture_x', type: 'ImageTexture', data: {} },
  ];
}

function strict({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

beforeEach(() => {
  traffic.pinned.length = 0;
  traffic.unpinned.length = 0;
  clearProceduralTextureCache();
});

describe('useProceduralTexture', () => {
  it('rasterises the gradient a SubResource reference names', () => {
    const resources = scene();
    const { result } = renderHook(() =>
      useProceduralTexture('SubResource("GradientTexture2D_a")', resources)
    );

    expect(result.current).toBeInstanceOf(THREE.DataTexture);
    expect(result.current!.image.width).toBe(8);
  });

  it('pins the texture while mounted and releases it on unmount', () => {
    const resources = scene();
    const key = proceduralTextureKey(resources, 'GradientTexture2D_a');
    const { unmount } = renderHook(() =>
      useProceduralTexture('SubResource("GradientTexture2D_a")', resources)
    );

    expect(traffic.pinned).toEqual([key]);
    expect(traffic.unpinned).toEqual([]);

    unmount();
    expect(traffic.unpinned).toEqual([key]);
  });

  it('pins nothing for a reference that resolves to no procedural texture', () => {
    const resources = scene();
    for (const ref of [
      undefined,
      'ExtResource("3")',
      'res://cookie.png',
      // A SubResource, but not a procedural texture: pinning its key would
      // hold a cache entry that does not exist.
      'SubResource("ImageTexture_x")',
      'SubResource("Nothing_here")',
    ]) {
      const { result, unmount } = renderHook(() =>
        useProceduralTexture(ref, resources)
      );
      expect(result.current, `ref: ${ref}`).toBeNull();
      unmount();
    }

    expect(traffic.pinned).toEqual([]);
    expect(traffic.unpinned).toEqual([]);
  });

  it('holds one pin across re-renders of the same reference', () => {
    const resources = scene();
    const { rerender } = renderHook(() =>
      useProceduralTexture('SubResource("GradientTexture2D_a")', resources)
    );

    rerender();
    rerender();

    // Re-pinning per render would cycle the count through zero, flushing
    // disposals a pinned replace deliberately deferred.
    expect(traffic.pinned).toHaveLength(1);
    expect(traffic.unpinned).toEqual([]);
  });

  it('moves the pin when the reference changes', () => {
    const resources = scene();
    const keyA = proceduralTextureKey(resources, 'GradientTexture2D_a');
    const keyB = proceduralTextureKey(resources, 'GradientTexture2D_b');
    const { rerender } = renderHook(
      ({ ref }: { ref: string }) => useProceduralTexture(ref, resources),
      { initialProps: { ref: 'SubResource("GradientTexture2D_a")' } }
    );

    rerender({ ref: 'SubResource("GradientTexture2D_b")' });

    expect(traffic.pinned).toEqual([keyA, keyB]);
    expect(traffic.unpinned).toEqual([keyA]);
  });

  it('leaves no pin behind after a StrictMode mount/unmount cycle', () => {
    const resources = scene();
    const { unmount } = renderHook(
      () => useProceduralTexture('SubResource("GradientTexture2D_a")', resources),
      { wrapper: strict }
    );
    unmount();

    // StrictMode's extra mount doubles the traffic; what matters is that every
    // pin is matched, or the entry outlives its consumer and never evicts.
    expect(traffic.pinned.length).toBeGreaterThan(0);
    expect(traffic.unpinned.sort()).toEqual(traffic.pinned.sort());
  });
});

describe('useProceduralTexturePins', () => {
  it('pins every key while mounted and releases them all on unmount', () => {
    const { unmount } = renderHook(() => useProceduralTexturePins(['s:one', 's:two']));

    expect(traffic.pinned).toEqual(['s:one', 's:two']);

    unmount();
    expect(traffic.unpinned).toEqual(['s:one', 's:two']);
  });

  it('pins nothing for an empty key list', () => {
    const { unmount } = renderHook(() => useProceduralTexturePins([]));
    unmount();

    expect(traffic.pinned).toEqual([]);
    expect(traffic.unpinned).toEqual([]);
  });

  it('ignores a rebuilt array carrying the same keys', () => {
    // Callers assemble this array in a memo whose identity turns over for
    // reasons that have nothing to do with which textures are held.
    const { rerender } = renderHook(({ keys }: { keys: string[] }) =>
      useProceduralTexturePins(keys), { initialProps: { keys: ['s:one'] } }
    );

    rerender({ keys: ['s:one'] });

    expect(traffic.pinned).toEqual(['s:one']);
    expect(traffic.unpinned).toEqual([]);
  });

  it('re-pins when the key set actually changes', () => {
    const { rerender } = renderHook(({ keys }: { keys: string[] }) =>
      useProceduralTexturePins(keys), { initialProps: { keys: ['s:one'] } }
    );

    rerender({ keys: ['s:one', 's:two'] });

    expect(traffic.pinned).toEqual(['s:one', 's:one', 's:two']);
    expect(traffic.unpinned).toEqual(['s:one']);
  });
});
