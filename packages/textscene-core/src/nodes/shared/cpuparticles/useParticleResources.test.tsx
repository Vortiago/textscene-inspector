import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { busServing } from '../../../resources/testing/servingFileBus';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';
import { CPU_PARTICLES_PARAM_COUNT, type ParticleParam } from './params';
import { useParticleResources } from './useParticleResources';

const NO_PARAMS: never[] = [];
const CURVE_FILE = 'res://fade.tres';
const OTHER_FILE = 'res://other.tres';
const FILES = {
  [CURVE_FILE]:
    '[gd_resource type="Curve" format=3]\n\n[resource]\n_data = [Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]\n',
  [OTHER_FILE]: '[gd_resource type="Resource" format=3]\n\n[resource]\n',
};
const EXTERNAL = [
  { id: '1_fade', type: 'Curve', path: CURVE_FILE },
  { id: '2_other', type: 'Resource', path: OTHER_FILE },
];

/** The parameter slots with `curve` on the scale slot. */
function paramsWithScale(curve: string): ParticleParam[] {
  return Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, (_, slot) =>
    slot === CPUParticlesParameter.SCALE ? { min: 0, max: 1, curve } : { min: 0, max: 1 }
  );
}

function loaderOver(files: Record<string, string>) {
  const { bus, provider, loads } = busServing(files);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return { loader, loads };
}

function hostOver(loader: ResourceLoader) {
  return ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={EXTERNAL}>
        {children}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

describe('useParticleResources', () => {
  it('keeps its result across renders that build an equal scaleCurves object', () => {
    const { result, rerender } = renderHook(() =>
      useParticleResources({
        params: NO_PARAMS,
        colorRamp: undefined,
        colorInitialRamp: undefined,
        scaleCurves: { x: 'SubResource("a")', y: undefined },
      })
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('gives one curve for each parameter slot, null where the slot names none', () => {
    const { result } = renderHook(() =>
      useParticleResources({
        params: NO_PARAMS,
        colorRamp: undefined,
        colorInitialRamp: undefined,
      })
    );

    expect(result.current.curves).toEqual(Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, () => null));
  });

  it('requests the .tres of a curve once and holds the curve after the load', async () => {
    const { loader, loads } = loaderOver(FILES);
    const references = {
      params: paramsWithScale('ExtResource("1_fade")'),
      colorRamp: undefined,
      colorInitialRamp: undefined,
    };

    const { result } = renderHook(() => useParticleResources(references), { wrapper: hostOver(loader) });
    expect(result.current.curves[CPUParticlesParameter.SCALE]).toBeNull();
    await settle();

    expect(result.current.curves[CPUParticlesParameter.SCALE]?.points).toHaveLength(2);
    expect(loads).toEqual([CURVE_FILE]);
  });

  it('gives the same result object when a file it did not read loads', async () => {
    const { loader } = loaderOver(FILES);
    const references = {
      params: paramsWithScale('ExtResource("1_fade")'),
      colorRamp: undefined,
      colorInitialRamp: undefined,
    };
    const { result } = renderHook(() => useParticleResources(references), { wrapper: hostOver(loader) });
    await settle();
    const loaded = result.current;

    loader.resources.request(OTHER_FILE);
    await settle();

    expect(result.current).toBe(loaded);
  });
});
