import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../parser/types';
import { NO_RESOURCES } from '../r3f/SceneResourcesContext';
import type { ResolvableResource } from './scopedResource';
import { NO_FILES, NO_FONTS } from './testing/loadedFiles';
import { NO_PROJECT_FONTS } from './fonts/font/projectFonts';
import { meshContentKey } from './meshes/meshSource';
import { useContentMemo } from './useContentMemo';

const box = (size: string): ResolvableResource => ({
  resource: { id: 'b', type: 'BoxMesh', data: { size } },
  resources: NO_RESOURCES,
  loadedFile: NO_FILES,
  loadedFont: NO_FONTS,
  projectFonts: NO_PROJECT_FONTS,
});

function renderMemo(initial: ResolvableResource | null) {
  const build = vi.fn((mesh: ResolvableResource) => ({ size: mesh.resource.data['size'] }));
  const hook = renderHook(({ mesh }) => useContentMemo(mesh, meshContentKey, build), {
    initialProps: { mesh: initial },
  });
  return { ...hook, build };
}

describe('useContentMemo', () => {
  it('keeps what it built while a fresh resource holds the same content', () => {
    const { result, rerender, build } = renderMemo(box('Vector3(1, 1, 1)'));
    const first = result.current;
    rerender({ mesh: box('Vector3(1, 1, 1)') });
    expect(result.current).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('builds again when the content changes', () => {
    const { result, rerender } = renderMemo(box('Vector3(1, 1, 1)'));
    rerender({ mesh: box('Vector3(2, 2, 2)') });
    expect(result.current).toEqual({ size: 'Vector3(2, 2, 2)' });
  });

  it('builds again when a Curve the mesh names changes content', () => {
    const tube = (curve: TscnInternalResource): ResolvableResource => ({
      resource: { id: 't', type: 'TubeTrailMesh', data: { curve: 'SubResource("c")' } },
      resources: { ...NO_RESOURCES, internalResources: [curve] },
      loadedFile: NO_FILES,
      loadedFont: NO_FONTS,
      projectFonts: NO_PROJECT_FONTS,
    });
    const curve = (bakeResolution: string): TscnInternalResource => ({
      id: 'c',
      type: 'Curve',
      data: { bake_resolution: bakeResolution },
    });
    const build = vi.fn((mesh: ResolvableResource) => mesh.resources.internalResources[0]!.data);
    const { result, rerender } = renderHook(({ mesh }) => useContentMemo(mesh, meshContentKey, build), {
      initialProps: { mesh: tube(curve('10')) },
    });

    rerender({ mesh: tube(curve('11')) });

    expect(result.current).toEqual({ bake_resolution: '11' });
  });

  it('is null for no resource, and builds nothing', () => {
    const { result, build } = renderMemo(null);
    expect(result.current).toBeNull();
    expect(build).not.toHaveBeenCalled();
  });
});
