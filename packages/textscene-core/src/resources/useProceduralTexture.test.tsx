/**
 * The borrow half of the procedural texture cache: what a mounted consumer pins, and what it must
 * not pin. `LRUCache.pin` tolerates an absent key, so a pin for a non-procedural reference is
 * silent. These tests hold resolution and pinning to one operation. A noise texture is a build:
 * the consumer starts it, keeps the texture it had until the new one lands, and drops it on unmount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Component, StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../parser/types';
import { fakeJobRunner } from '../workers/fakeJobRunner.testkit';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import type { ResourceLoader } from './ResourceLoader';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { abortProceduralBuilds, type JobRunner } from './textures/proceduralBuilds';
import { pendingTextureWork, subscribeTextureWork } from './textures/textureWork';
import {
  useProceduralTexture,
  useProceduralTexturePins,
  useProceduralTextures,
  type ProceduralSlot,
} from './useProceduralTexture';
import { clearProceduralTextureCache, proceduralTextureKey } from './textures/proceduralTextureCache';

/** The cache exposes no pin counter, so the two entry points are wrapped, calling through. */
const traffic = vi.hoisted(() => ({ pinned: [] as string[], unpinned: [] as string[] }));

vi.mock('./textures/proceduralTextureCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./textures/proceduralTextureCache')>();
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

/** Two gradients plus a texture sub-resource that is not procedural, which must mint no key. */
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

afterEach(() => {
  abortProceduralBuilds();
});

describe('useProceduralTexture', () => {
  it('rasterises the gradient a SubResource reference names', () => {
    const resources = scene();
    const { result } = renderHook(() =>
      useProceduralTexture('SubResource("GradientTexture2D_a")', resources)
    );

    expect(result.current).toMatchObject({ claimed: true });
    expect(result.current.texture).toBeInstanceOf(THREE.DataTexture);
    expect((result.current.texture as THREE.DataTexture).image.width).toBe(8);
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
      const { result, unmount } = renderHook(() => useProceduralTexture(ref, resources));
      expect(result.current, `ref: ${ref}`).toEqual({ texture: null, claimed: false, building: false });
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
    const { rerender } = renderHook(({ ref }: { ref: string }) => useProceduralTexture(ref, resources), {
      initialProps: { ref: 'SubResource("GradientTexture2D_a")' },
    });

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
    const { rerender } = renderHook(({ keys }: { keys: string[] }) => useProceduralTexturePins(keys), {
      initialProps: { keys: ['s:one'] },
    });

    rerender({ keys: ['s:one'] });

    expect(traffic.pinned).toEqual(['s:one']);
    expect(traffic.unpinned).toEqual([]);
  });

  it('re-pins when the key set actually changes', () => {
    const { rerender } = renderHook(({ keys }: { keys: string[] }) => useProceduralTexturePins(keys), {
      initialProps: { keys: ['s:one'] },
    });

    rerender({ keys: ['s:one', 's:two'] });

    expect(traffic.pinned).toEqual(['s:one', 's:one', 's:two']);
    expect(traffic.unpinned).toEqual(['s:one']);
  });
});

/** A 4x4 NoiseTexture2D whose FastNoiseLite seed is its whole content. */
function noiseScene(seed: number): TscnInternalResource[] {
  return [
    { id: 'FastNoiseLite_a', type: 'FastNoiseLite', data: { seed: String(seed), frequency: '0.05' } },
    {
      id: 'NoiseTexture2D_a',
      type: 'NoiseTexture2D',
      data: { noise: 'SubResource("FastNoiseLite_a")', width: '4', height: '4' },
    },
    { id: 'Gradient_a', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
    },
  ];
}

const NOISE = 'SubResource("NoiseTexture2D_a")';
const GRADIENT = 'SubResource("GradientTexture2D_a")';

/** Lets microtasks, promise callbacks and the resulting renders run. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** A loader whose job runner the test drives, and a wrapper that provides it. */
function withRunner(runner: JobRunner, strictMode = false) {
  const fake = createFakeResourceLoader();
  // Assigned, not spread: a spread would freeze the loader's pending-count getter.
  const loader = Object.assign(fake.loader, { jobRunner: runner }) as ResourceLoader;
  const wrapper = ({ children }: { children: ReactNode }) => {
    const provided = <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>;
    return strictMode ? <StrictMode>{provided}</StrictMode> : provided;
  };
  return { loader, wrapper };
}

function renderSlots(runner: JobRunner, resources: TscnInternalResource[], strictMode = false) {
  const { loader, wrapper } = withRunner(runner, strictMode);
  const hook = renderHook(
    ({ scene }: { scene: TscnInternalResource[] }) => useProceduralTextures([NOISE, GRADIENT], scene),
    { initialProps: { scene: resources }, wrapper }
  );
  return { ...hook, loader };
}

describe('useProceduralTextures with a NoiseTexture2D', () => {
  it('claims the slot and draws nothing in it until the build lands', () => {
    const { runner } = fakeJobRunner();
    const { result } = renderSlots(runner, noiseScene(1));

    expect(result.current[0]).toEqual({ texture: null, claimed: true, building: true });
    expect(result.current[1]).toMatchObject({ claimed: true, building: false });
    expect(result.current[1]?.texture).toBeInstanceOf(THREE.Texture);
  });

  it('counts a pending build as a pending load on the loader', async () => {
    const { runner } = fakeJobRunner();
    const { loader } = renderSlots(runner, noiseScene(1));
    await flush();

    expect(loader.pendingResourceCount).toBe(1);
  });

  it('shows the built texture once the build lands, and stops counting it', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, loader } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.complete();
    await flush();

    expect(result.current[0]?.texture).toBeInstanceOf(THREE.DataTexture);
    expect(loader.pendingResourceCount).toBe(0);
  });

  it('keeps the texture work counted until the commit that shows the built texture', async () => {
    const { runner, runs } = fakeJobRunner();
    const { wrapper } = withRunner(runner);
    // Marked at commit, in a layout effect: `result.current` updates later, in a passive effect.
    let isShown = false;
    renderHook(
      () => {
        const slots = useProceduralTextures([NOISE], noiseScene(1));
        useLayoutEffect(() => {
          isShown = slots[0]?.texture instanceof THREE.DataTexture;
        });
        return slots;
      },
      { wrapper }
    );
    await flush();
    const countsBeforeShown: number[] = [];
    const unsubscribe = subscribeTextureWork(() => {
      if (!isShown) countsBeforeShown.push(pendingTextureWork());
    });
    runs[0]?.complete();
    await flush();
    unsubscribe();

    expect(isShown).toBe(true);
    expect(countsBeforeShown).not.toContain(0);
    expect(pendingTextureWork()).toBe(0);
  });

  it('keeps the old texture through an edit, then swaps and unpins it', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.complete();
    await flush();
    const before = result.current[0]?.texture;
    const pinnedBefore = [...traffic.pinned];

    rerender({ scene: noiseScene(2) });
    await flush();
    expect(result.current[0]).toEqual({ texture: before, claimed: true, building: true });

    runs[1]?.complete();
    await flush();
    expect(result.current[0]?.texture).not.toBe(before);
    const oldKey = pinnedBefore.find((key) => key.startsWith('NoiseTexture2D:'));
    expect(traffic.unpinned).toContain(oldKey);
  });

  it('reuses the texture across a re-parse that leaves the noise unchanged', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.complete();
    await flush();
    const built = result.current[0]?.texture;

    rerender({ scene: noiseScene(1) });
    expect(result.current[0]).toEqual({ texture: built, claimed: true, building: false });
    expect(runs).toHaveLength(1);
  });

  it('cancels a build that a later edit supersedes, and never shows its result', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    rerender({ scene: noiseScene(2) });
    await flush();

    expect(runs[0]?.signal?.aborted).toBe(true);
    runs[1]?.complete();
    await flush();
    const shown = result.current[0]?.texture as THREE.DataTexture;
    runs[0]?.complete();
    await flush();
    expect(result.current[0]?.texture).toBe(shown);
  });

  it('starts one build under StrictMode, and keeps it running', async () => {
    const { runner, runs } = fakeJobRunner();
    renderSlots(runner, noiseScene(1), true);
    await flush();

    expect(runs).toHaveLength(1);
    expect(runs[0]?.signal?.aborted).toBe(false);
  });

  it('cancels the build and releases every pin on unmount', async () => {
    const { runner, runs } = fakeJobRunner();
    const { unmount } = renderSlots(runner, noiseScene(1));
    await flush();
    unmount();
    await flush();

    expect(runs[0]?.signal?.aborted).toBe(true);
    expect([...traffic.unpinned].sort()).toEqual([...traffic.pinned].sort());
  });

  it('draws nothing for a build that cannot allocate, and does not retry it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { runner, runs } = fakeJobRunner();
    const { result } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.reject(new RangeError('Array buffer allocation failed'));
    await flush();

    expect(result.current[0]).toEqual({ texture: null, claimed: true, building: false });
    expect(runs).toHaveLength(1);
    warn.mockRestore();
  });

  it('hands any other build failure to the error boundary', async () => {
    const { runner, runs } = fakeJobRunner();
    const { wrapper } = withRunner(runner);
    const caught: unknown[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Consumer(): null {
      useProceduralTextures([NOISE], noiseScene(1));
      return null;
    }
    render(
      <Catch onError={(e) => caught.push(e)}>
        <Consumer />
      </Catch>,
      { wrapper }
    );
    await flush();
    runs[0]?.reject(new TypeError('bad noise input'));
    await flush();

    expect(caught[0]).toBeInstanceOf(TypeError);
    error.mockRestore();
  });

  it('builds in-thread outside a loader provider', async () => {
    const { result } = renderHook(() => useProceduralTextures([NOISE], noiseScene(1)));
    await flush();

    const [slot] = result.current as ProceduralSlot[];
    expect(slot?.texture).toBeInstanceOf(THREE.DataTexture);
  });
});

class Catch extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
