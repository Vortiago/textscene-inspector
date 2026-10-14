/**
 * `useTexture3D`: the texture a Texture3D slot holds, a NoiseTexture3D inline or saved as its own
 * `.tres`, or an image its Import sidecar imports as a 3D texture.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseTresFile } from '../parser/parsedResource';
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
const NOISE_TRES = `[gd_resource type="NoiseTexture3D" format=3]

[sub_resource type="FastNoiseLite" id="FastNoiseLite_huop3"]

[resource]
width = 2
height = 2
depth = 2
noise = SubResource("FastNoiseLite_huop3")
`;

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

  it('builds a NoiseTexture3D saved as its own .tres, with no request to the texture3d bus', async () => {
    const { fake, wrapper } = withLoader();
    const request = vi.fn();
    fake.textures3D.setRequestImpl(request);
    fake.resources.seed('res://fog/noise.tres', parseTresFile(NOISE_TRES));

    const { result } = renderHook(
      () => useTexture3D('ExtResource("1")', { internalResources: [], externalResources: TEXT_RESOURCE }),
      { wrapper }
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(result.current).toBeInstanceOf(THREE.Data3DTexture);
    expect(request).not.toHaveBeenCalled();
  });

  it('stacks an ImageTexture3D .tres from its saved images', () => {
    const { fake, wrapper } = withLoader();
    fake.resources.seed(
      'res://fog/noise.tres',
      parseTresFile(`[gd_resource type="ImageTexture3D" format=3]

[sub_resource type="Image" id="Image_a"]
data = {
"data": PackedByteArray(63),
"format": "Lum8",
"height": 1,
"mipmaps": false,
"width": 1
}

[resource]
_images = Array[Image]([SubResource("Image_a")])
`)
    );

    const { result } = renderHook(
      () => useTexture3D('ExtResource("1")', { internalResources: [], externalResources: TEXT_RESOURCE }),
      { wrapper }
    );

    expect(result.current?.image).toMatchObject({ width: 1, height: 1, depth: 1 });
  });

  it('holds nothing for a .tres of a type the previewer cannot build (edge case)', () => {
    const { fake, wrapper } = withLoader();
    fake.resources.seed(
      'res://fog/noise.tres',
      parseTresFile('[gd_resource type="CompressedTexture3D" format=3]\n\n[resource]\n')
    );

    const { result } = renderHook(
      () => useTexture3D('ExtResource("1")', { internalResources: [], externalResources: TEXT_RESOURCE }),
      { wrapper }
    );

    expect(result.current).toBeNull();
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
