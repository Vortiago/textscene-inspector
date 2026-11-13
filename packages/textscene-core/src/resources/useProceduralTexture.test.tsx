/**
 * The borrow half of the procedural texture cache: what a mounted consumer pins, and what it must
 * not pin. `LRUCache.pin` tolerates an absent key, so a pin for a non-procedural texture is
 * silent. These tests hold resolution and pinning to one operation. A noise texture is a build:
 * the consumer starts it, keeps the texture it had until the new one lands, and drops it on unmount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Component, StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { loadedValue } from './reading/reading.testkit';
import { fakeJobRunner } from '../workers/fakeJobRunner.testkit';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader, withJobRunner } from './testing/createFakeResourceLoader';
import { resetProceduralTextures, type JobRunner } from './textures/proceduralBuilds';
import { textureWork } from './textures/textureWork';
import { proceduralTexture2D, proceduralTexture3D } from './textures/resolveProceduralTexture';
import { TEXTURE_2D } from './textures/texture2d/kind';
import { TEXTURE_3D } from './textures/texture3d/kind';
import { useProceduralTexture, useProceduralTexturePins, type ProceduralSlot } from './useProceduralTexture';
import type { ProceduralTextureLookup } from './textures/proceduralBuilds';

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

/** Two gradients over one Gradient. */
const SCENE = `[sub_resource type="Gradient" id="Gradient_a"]
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="GradientTexture2D_a"]
gradient = SubResource("Gradient_a")
width = 8
height = 8

[sub_resource type="GradientTexture2D" id="GradientTexture2D_b"]
gradient = SubResource("Gradient_a")
width = 4
height = 4
`;

/** The lookup of the Texture2D `ref` names in tables written as `sceneText`, freshly decoded. */
function lookupOf(ref: string, sceneText = SCENE): ProceduralTextureLookup | null {
  const texture = loadedValue(TEXTURE_2D, ref, sceneText);
  if (texture.form === 'canvas' || texture.form === 'atlas')
    throw new Error(`expected a source, got ${texture.form}`);
  return proceduralTexture2D(texture);
}

function strict({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

beforeEach(() => {
  traffic.pinned.length = 0;
  traffic.unpinned.length = 0;
  resetProceduralTextures();
});

afterEach(() => {
  resetProceduralTextures();
});

describe('useProceduralTexture', () => {
  it('rasterises the gradient the lookup gives', () => {
    const lookup = lookupOf('SubResource("GradientTexture2D_a")');
    const { result } = renderHook(() => useProceduralTexture(lookup));

    expect(result.current).toMatchObject({ claimed: true });
    expect(result.current.texture).toBeInstanceOf(THREE.DataTexture);
    expect((result.current.texture as THREE.DataTexture).image.width).toBe(8);
  });

  it('pins the texture while mounted and releases it on unmount', () => {
    const lookup = lookupOf('SubResource("GradientTexture2D_a")');
    const key = lookup!.key;
    const { unmount } = renderHook(() => useProceduralTexture(lookup));

    expect(traffic.pinned).toEqual([key]);
    expect(traffic.unpinned).toEqual([]);

    unmount();
    expect(traffic.unpinned).toEqual([key]);
  });

  it('leaves the slot unclaimed and pins nothing with no lookup', () => {
    const { result, unmount } = renderHook(() => useProceduralTexture(null));
    expect(result.current).toEqual({ texture: null, claimed: false, building: false });
    unmount();

    expect(traffic.pinned).toEqual([]);
    expect(traffic.unpinned).toEqual([]);
  });

  it('holds one pin across re-renders of the same lookup', () => {
    const lookup = lookupOf('SubResource("GradientTexture2D_a")');
    const { rerender } = renderHook(() => useProceduralTexture(lookup));

    rerender();
    rerender();

    // Re-pinning per render would cycle the count through zero, flushing
    // disposals a pinned replace deliberately deferred.
    expect(traffic.pinned).toHaveLength(1);
    expect(traffic.unpinned).toEqual([]);
  });

  it('moves the pin when the lookup changes', () => {
    const a = lookupOf('SubResource("GradientTexture2D_a")');
    const b = lookupOf('SubResource("GradientTexture2D_b")');
    const [keyA, keyB] = [a!.key, b!.key];
    const { rerender } = renderHook(
      ({ lookup }: { lookup: ProceduralTextureLookup | null }) => useProceduralTexture(lookup),
      { initialProps: { lookup: a } }
    );

    rerender({ lookup: b });

    expect(traffic.pinned).toEqual([keyA, keyB]);
    expect(traffic.unpinned).toEqual([keyA]);
  });

  it('leaves no pin behind after a StrictMode mount/unmount cycle', () => {
    const lookup = lookupOf('SubResource("GradientTexture2D_a")');
    const { unmount } = renderHook(() => useProceduralTexture(lookup), { wrapper: strict });
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

/** A 4x4 NoiseTexture2D whose FastNoiseLite seed is its whole content, beside a gradient. */
function noiseScene(seed: number): string {
  return `[sub_resource type="FastNoiseLite" id="FastNoiseLite_a"]
seed = ${seed}
frequency = 0.05

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_a"]
noise = SubResource("FastNoiseLite_a")
width = 4
height = 4

[sub_resource type="NoiseTexture3D" id="NoiseTexture3D_a"]
noise = SubResource("FastNoiseLite_a")
width = 4
height = 3
depth = 2

${SCENE}`;
}

const NOISE = 'SubResource("NoiseTexture2D_a")';
const GRADIENT = 'SubResource("GradientTexture2D_a")';

/** The noise and the gradient lookups of a scene, each decoded once, as a slot's memo keeps them. */
function lookupsOf(sceneText: string) {
  return [lookupOf(NOISE, sceneText), lookupOf(GRADIENT, sceneText)] as const;
}

/** Lets microtasks, promise callbacks and the resulting renders run. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** A loader whose job runner the test drives, and a wrapper that provides it. */
function withRunner(runner: JobRunner, strictMode = false) {
  const fake = createFakeResourceLoader();
  const loader = withJobRunner(fake, runner);
  const wrapper = ({ children }: { children: ReactNode }) => {
    const provided = <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>;
    return strictMode ? <StrictMode>{provided}</StrictMode> : provided;
  };
  return { loader, wrapper };
}

function renderSlots(runner: JobRunner, sceneText: string, strictMode = false) {
  const { loader, wrapper } = withRunner(runner, strictMode);
  const hook = renderHook(
    ({ lookups }: { lookups: ReturnType<typeof lookupsOf> }) => [
      useProceduralTexture(lookups[0]),
      useProceduralTexture(lookups[1]),
    ],
    { initialProps: { lookups: lookupsOf(sceneText) }, wrapper }
  );
  return { ...hook, loader, rerender: (next: string) => hook.rerender({ lookups: lookupsOf(next) }) };
}

describe('useProceduralTexture with a NoiseTexture2D', () => {
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
    const lookup = lookupOf(NOISE, noiseScene(1));
    renderHook(
      () => {
        const slots = [useProceduralTexture(lookup)];
        useLayoutEffect(() => {
          isShown = slots[0]?.texture instanceof THREE.DataTexture;
        });
        return slots;
      },
      { wrapper }
    );
    await flush();
    const countsBeforeShown: number[] = [];
    const unsubscribe = textureWork.subscribe(() => {
      if (!isShown) countsBeforeShown.push(textureWork.pending());
    });
    runs[0]?.complete();
    await flush();
    unsubscribe();

    expect(isShown).toBe(true);
    expect(countsBeforeShown).not.toContain(0);
    expect(textureWork.pending()).toBe(0);
  });

  it('keeps the old texture through an edit, then swaps and unpins it', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.complete();
    await flush();
    const before = result.current[0]?.texture;
    const pinnedBefore = [...traffic.pinned];

    rerender(noiseScene(2));
    await flush();
    expect(result.current[0]).toEqual({ texture: before, claimed: true, building: true });

    runs[1]?.complete();
    await flush();
    expect(result.current[0]?.texture).not.toBe(before);
    const oldKey = pinnedBefore.find((key) => key.startsWith('NoiseTexture2D:'));
    expect(traffic.unpinned).toContain(oldKey);
  });

  it('reuses the texture across a new decode that leaves the noise unchanged', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    runs[0]?.complete();
    await flush();
    const built = result.current[0]?.texture;

    rerender(noiseScene(1));
    expect(result.current[0]).toEqual({ texture: built, claimed: true, building: false });
    expect(runs).toHaveLength(1);
  });

  it('cancels a build that a later edit supersedes, and never shows its result', async () => {
    const { runner, runs } = fakeJobRunner();
    const { result, rerender } = renderSlots(runner, noiseScene(1));
    await flush();
    rerender(noiseScene(2));
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
    const lookup = lookupOf(NOISE, noiseScene(1));
    function Consumer(): null {
      useProceduralTexture(lookup);
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
    const lookup = lookupOf(NOISE, noiseScene(1));
    const { result } = renderHook(() => [useProceduralTexture(lookup)]);
    await flush();

    const [slot] = result.current as ProceduralSlot[];
    expect(slot?.texture).toBeInstanceOf(THREE.DataTexture);
  });
});

describe('useProceduralTexture with a NoiseTexture3D', () => {
  it('builds the volume', async () => {
    const lookup = proceduralTexture3D(
      loadedValue(TEXTURE_3D, 'SubResource("NoiseTexture3D_a")', noiseScene(1))
    );
    const { result } = renderHook(() => useProceduralTexture(lookup));
    await flush();

    expect(result.current.texture).toBeInstanceOf(THREE.Data3DTexture);
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
