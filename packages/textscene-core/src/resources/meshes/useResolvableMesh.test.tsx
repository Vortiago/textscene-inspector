import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { parseTresFile } from '../../parser/parsedResource';
import { MissingResourcesProvider } from '../../r3f/contexts/MissingResourcesContext';
import { NO_RESOURCES } from '../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import type { ScopedResource } from '../scopedResource';
import { createFakeResourceLoader } from '../testing/createFakeResourceLoader';
import { COARSE_TUBE, curveEndingAt } from './primitivemesh/surface.testkit';
import { useResolvableMesh } from './useResolvableMesh';

const CURVE_PATH = 'res://grow.tres';
const CURVE_FILE = parseTresFile(
  `[gd_resource type="Curve" format=3]\n\n[resource]\n_data = ${curveEndingAt('3')._data}\n`
);

const TUBE: ScopedResource = {
  resource: { id: 'tube', type: 'TubeTrailMesh', data: { ...COARSE_TUBE, curve: 'ExtResource("1")' } },
  resources: { ...NO_RESOURCES, externalResources: [{ id: '1', type: 'Curve', path: CURVE_PATH }] },
};
const BOX: ScopedResource = {
  resource: { id: 'box', type: 'BoxMesh', data: {} },
  resources: NO_RESOURCES,
};

function renderMesh(scoped: ScopedResource | null) {
  const fake = createFakeResourceLoader();
  const result = renderHook(() => useResolvableMesh(scoped), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      </MissingResourcesProvider>
    ),
  }).result;
  return { fake, result };
}

describe('useResolvableMesh', () => {
  it('loads while the Curve file of a TubeTrailMesh is not there, then serves it', () => {
    const { fake, result } = renderMesh(TUBE);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.mesh!.loadedFile(CURVE_PATH)).toBeUndefined();

    act(() => fake.resources._resolve(CURVE_PATH, CURVE_FILE));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mesh!.loadedFile(CURVE_PATH)).toBe(CURVE_FILE);
  });

  it('keeps the mesh and its tables as given', () => {
    const { result } = renderMesh(TUBE);

    expect(result.current.mesh).toMatchObject(TUBE);
  });

  it('is not loading for a mesh that reads no file', () => {
    const { result } = renderMesh(BOX);

    expect(result.current.isLoading).toBe(false);
  });

  it('is no mesh, and not loading, for none', () => {
    const { result } = renderMesh(null);

    expect(result.current).toEqual({ mesh: null, isLoading: false });
  });
});
