/**
 * The maps a CanvasTexture adds to a textured canvas item: its normal map and specular map, read
 * raw, and its specular shading, which Godot uses only with a normal map.
 */

import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useCanvasItemSurface } from './useCanvasItemSurface';
import { decodeCanvasTexture } from '../resources/textures/canvastexture/decode';
import type { CanvasTextureSlot } from '../resources/useTexture2D';
import type { TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../godot/scene/canvasItem';
import { decodeAtlasTexture } from '../resources/textures/atlastexture/decode';
import { imageSize } from '../resources/formats/image/imagePixels';

const MAP: TscnInternalResource[] = [
  {
    id: 'Gradient_flat',
    type: 'Gradient',
    data: { colors: 'PackedColorArray(0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1)' },
  },
  {
    id: 'GradientTexture2D_flat',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_flat")', width: '4', height: '4' },
  },
];

const SAMPLER = { filter: CanvasItemTextureFilter.LINEAR, repeat: CanvasItemTextureRepeat.DISABLED };

function slot(properties: Record<string, string>): CanvasTextureSlot {
  return { texture: decodeCanvasTexture(properties), externalResources: [], internalResources: MAP };
}

function surfaceOf(canvasTexture: CanvasTextureSlot | undefined) {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  return renderHook(() => useCanvasItemSurface(canvasTexture, SAMPLER), { wrapper }).result.current;
}

describe('useCanvasItemSurface', () => {
  it('reads the normal map raw, without the sRGB decode', () => {
    const surface = surfaceOf(slot({ normal_texture: 'SubResource("GradientTexture2D_flat")' }));
    expect(surface?.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(surface?.specularMap).toBeNull();
    expect(surface?.specular).toBeNull();
  });

  it('reads the specular map and its shading beside a normal map', () => {
    const surface = surfaceOf(
      slot({
        normal_texture: 'SubResource("GradientTexture2D_flat")',
        specular_texture: 'SubResource("GradientTexture2D_flat")',
        specular_shininess: '0.5',
      })
    );
    expect(surface?.specularMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(surface?.specular).toEqual({ r: 1, g: 1, b: 1, a: 127 / 255 });
  });

  it('is null without a normal map, which specular needs', () => {
    expect(surfaceOf(slot({ specular_shininess: '0.5' }))).toBeNull();
  });

  it("cuts the normal map by the AtlasTexture's fraction of the diffuse sheet", () => {
    // The diffuse sheet is 8 by 8 and the map 4 by 4, so the left half of the diffuse is 2 texels.
    const atlas = {
      reference: { id: 'AtlasTexture_half', texture: decodeAtlasTexture({ region: 'Rect2(0, 0, 4, 8)' }) },
      sheetSize: { width: 8, height: 8 },
    };
    const surface = surfaceOf({
      ...slot({ normal_texture: 'SubResource("GradientTexture2D_flat")' }),
      atlas,
    });
    expect(imageSize(surface?.normalMap.image)).toEqual({ width: 2, height: 4 });
  });

  it('reads no normal map from a CanvasTexture, which Godot refuses to nest', () => {
    // `canvas_item.cpp:1801`: `set_normal_texture` refuses a CanvasTexture.
    const nested: CanvasTextureSlot = {
      ...slot({ normal_texture: 'SubResource("CanvasTexture_inner")' }),
      internalResources: [
        ...MAP,
        {
          id: 'CanvasTexture_inner',
          type: 'CanvasTexture',
          data: { diffuse_texture: 'SubResource("GradientTexture2D_flat")' },
        },
      ],
    };
    expect(surfaceOf(nested)).toBeNull();
  });

  it('is null with no CanvasTexture', () => {
    expect(surfaceOf(undefined)).toBeNull();
  });
});
