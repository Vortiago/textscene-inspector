/**
 * `useTexture3D`: the texture a Texture3D slot holds, an inline NoiseTexture3D or an image its
 * Import sidecar imports as a 3D texture.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { useTexture3D } from './useTexture3D';

const NOISE_TEXTURE: TscnInternalResource[] = [
  { id: 'noise', type: 'FastNoiseLite', data: {} },
  {
    id: 'volume',
    type: 'NoiseTexture3D',
    data: { noise: 'SubResource("noise")', width: '2', height: '2', depth: '2' },
  },
];

const IMAGE: TscnExternalResource[] = [
  { id: '1', type: 'CompressedTexture3D', path: 'res://fog/density.png' },
];
const TEXT_RESOURCE: TscnExternalResource[] = [
  { id: '1', type: 'NoiseTexture3D', path: 'res://fog/noise.tres' },
];

function withLoader() {
  const fake = createFakeResourceLoader();
  return {
    fake,
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
    },
  };
}

describe('useTexture3D', () => {
  it('loads an ExtResource image through the texture3d bus', () => {
    const { fake, wrapper } = withLoader();
    const texture = new THREE.Data3DTexture(new Uint8Array(8), 1, 2, 1);
    fake.textures3D.seed('res://fog/density.png', texture);

    const { result } = renderHook(
      () => useTexture3D('ExtResource("1")', { internalResources: [], externalResources: IMAGE }),
      { wrapper }
    );

    expect(result.current).toBe(texture);
  });

  it('builds an inline NoiseTexture3D with no file round trip', async () => {
    const { fake, wrapper } = withLoader();
    const request = vi.fn();
    fake.textures3D.setRequestImpl(request);

    const { result } = renderHook(
      () =>
        useTexture3D('SubResource("volume")', { internalResources: NOISE_TEXTURE, externalResources: [] }),
      { wrapper }
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(result.current).toBeInstanceOf(THREE.Data3DTexture);
    expect(request).not.toHaveBeenCalled();
  });

  it('requests no text resource, which the texture3d bus cannot decode (edge case)', () => {
    const { fake, wrapper } = withLoader();
    const request = vi.fn();
    fake.textures3D.setRequestImpl(request);

    const { result } = renderHook(
      () => useTexture3D('ExtResource("1")', { internalResources: [], externalResources: TEXT_RESOURCE }),
      { wrapper }
    );

    expect(result.current).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('holds nothing for no reference', () => {
    const { wrapper } = withLoader();
    const { result } = renderHook(
      () => useTexture3D(undefined, { internalResources: [], externalResources: [] }),
      {
        wrapper,
      }
    );
    expect(result.current).toBeNull();
  });
});
