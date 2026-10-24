import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { useGlb } from './useGlb';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';

/** `useGlb(path)` over a fake loader that records each GLB request. */
function renderUseGlb(path: string | undefined, loaded?: THREE.Object3D) {
  const fake = createFakeResourceLoader();
  if (loaded && path) fake.glbMeshes.seed(path, loaded);
  const requested = vi.fn();
  fake.glbMeshes.setRequestImpl(requested);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  return { requested, ...renderHook(() => useGlb(path), { wrapper }) };
}

describe('useGlb', () => {
  it('requests the GLB at the path from the GLB bus', () => {
    const { requested } = renderUseGlb('res://model.glb');
    expect(requested).toHaveBeenCalledWith('res://model.glb');
  });

  it('answers a GLB already loaded at the path', () => {
    const { result } = renderUseGlb('res://model.glb', new THREE.Group());
    expect(result.current.status).toBe('loaded');
    expect(result.current.value).toBeInstanceOf(THREE.Object3D);
  });

  it('requests nothing for no path (edge case)', () => {
    const { requested, result } = renderUseGlb(undefined);
    expect(requested).not.toHaveBeenCalled();
    expect(result.current.value).toBeUndefined();
  });
});
