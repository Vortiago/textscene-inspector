/**
 * The surface a material's textures draw on: a glTF surface keeps Godot's top-down V in its UVs,
 * while every bound texture uploads bottom-up, so its maps sample `1 - v`.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { UV2_CHANNEL } from '../../resources/meshes/uv2';
import { GLTF_SURFACE, useMaterialTextures, type TexturedSurface } from './SurfaceMaterialSlot';

const GRADIENT: TscnInternalResource[] = [
  { id: 'Gradient_a', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
  {
    id: 'GradientTexture2D_a',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
  },
];

/** The emission map a material with `properties` binds on `surface`. */
function emissionMap(properties: Record<string, string>, surface?: TexturedSurface): THREE.Texture {
  const scalars = parseStandardMaterial3DScalars({
    emission_enabled: 'true',
    emission_texture: 'SubResource("GradientTexture2D_a")',
    ...properties,
  });
  const { loader } = createFakeResourceLoader();
  const { result } = renderHook(
    () => useMaterialTextures(scalars, { internalResources: GRADIENT, externalResources: [] }, surface),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
      ),
    }
  );
  return result.current.maps.emissiveMap!;
}

describe('useMaterialTextures on a glTF surface', () => {
  it("samples the glTF surface's top-down V", () => {
    const map = emissionMap({}, GLTF_SURFACE);

    expect([map.repeat.y, map.offset.y]).toEqual([-1, 1]);
  });

  it('flips V after the UV1 scale and offset, as Godot applies them first', () => {
    const map = emissionMap(
      { uv1_scale: 'Vector3(2, 3, 1)', uv1_offset: 'Vector3(0.25, 0.75, 0)' },
      GLTF_SURFACE
    );

    expect([map.repeat.x, map.offset.x, map.repeat.y, map.offset.y]).toEqual([2, 0.25, -3, 0.25]);
  });

  it('flips a UV2 map too, whose cached UV2 keeps the top-down V', () => {
    const map = emissionMap({ emission_on_uv2: 'true' }, GLTF_SURFACE);

    expect([map.channel, map.repeat.y, map.offset.y]).toEqual([UV2_CHANNEL, -1, 1]);
  });

  it("keeps a Godot mesh's map unflipped, as its UVs are bottom-up (edge case)", () => {
    const map = emissionMap({});

    expect([map.repeat.y, map.offset.y]).toEqual([1, 0]);
  });
});
