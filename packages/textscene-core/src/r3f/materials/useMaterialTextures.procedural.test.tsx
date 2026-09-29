/**
 * A StandardMaterial3D slot that names an inline procedural texture: a gradient
 * binds at once, a noise texture binds when its build lands and keeps its old map
 * through an edit. Neither asks the file pipeline for anything.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../../parser/types';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { abortProceduralBuilds } from '../../resources/textures/proceduralBuilds';
import { clearProceduralTextureCache } from '../../resources/textures/proceduralTextureCache';
import { fakeJobRunner } from '../../workers/fakeJobRunner.testkit';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { useMaterialTextures } from './SurfaceMaterialSlot';

function scene(seed: number): TscnInternalResource[] {
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

const SCALARS = parseStandardMaterial3DScalars({
  albedo_texture: 'SubResource("NoiseTexture2D_a")',
  emission_enabled: 'true',
  emission_texture: 'SubResource("GradientTexture2D_a")',
});

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderMaterial() {
  const { runner, runs } = fakeJobRunner();
  const fake = createFakeResourceLoader();
  const loader = Object.assign(fake.loader, { jobRunner: runner }) as ResourceLoader;
  const requested: string[] = [];
  fake.textures.setRequestImpl((path) => requested.push(path));
  // The wrapper sees no hook props, so an edit swaps this and re-renders.
  let resources = scene(1);
  const hook = renderHook(() => useMaterialTextures(SCALARS), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={resources}>{children}</SceneResourcesProvider>
      </ResourceLoaderProvider>
    ),
  });
  const edit = (seed: number) => {
    resources = scene(seed);
    hook.rerender();
  };
  return { ...hook, runs, requested, edit };
}

afterEach(() => {
  abortProceduralBuilds();
  clearProceduralTextureCache();
});

describe('useMaterialTextures with procedural slots', () => {
  it('binds a gradient at once and leaves a building noise slot empty', () => {
    const { result, requested } = renderMaterial();

    expect(result.current.maps.emissiveMap).toBeDefined();
    expect(result.current.maps.albedoMap).toBeUndefined();
    expect(result.current.firstMissingPath).toBeNull();
    expect(requested).toEqual([]);
  });

  it('binds the noise map once its build lands', async () => {
    const { result, runs } = renderMaterial();
    await flush();
    runs[0]?.complete();
    await flush();

    expect((result.current.maps.albedoMap?.image as { width: number } | undefined)?.width).toBe(4);
  });

  it('keeps the old noise map through an edit until the new one lands', async () => {
    const { result, runs, edit } = renderMaterial();
    await flush();
    runs[0]?.complete();
    await flush();
    const before = result.current.maps.albedoMap?.image;

    edit(2);
    await flush();
    expect(result.current.maps.albedoMap?.image).toBe(before);

    runs[1]?.complete();
    await flush();
    expect(result.current.maps.albedoMap?.image).not.toBe(before);
  });
});
