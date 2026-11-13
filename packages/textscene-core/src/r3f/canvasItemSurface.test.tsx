/**
 * The maps a CanvasTexture adds to a textured canvas item: its normal map and specular map, read
 * raw, and its specular shading, which Godot uses only with a normal map.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { render } from '@testing-library/react';
import { CanvasItemSurfaceSource } from './canvasItemSurface';
import type { CanvasItemSurface } from './lighting2d/normalMappedLighting';
import { decodeCanvasTexture } from '../resources/textures/canvastexture/decode';
import type { CanvasTextureSlot } from '../resources/useTexture2D';
import { referenceIn } from '../resources/reading/scopedReference.testkit';
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

/** A CanvasTexture slot whose maps resolve in `internalResources`. */
function slot(
  properties: Record<string, string>,
  internalResources: readonly TscnInternalResource[] = MAP
): CanvasTextureSlot {
  const map = (ref: string | undefined) =>
    ref === undefined ? null : referenceIn(ref, [], internalResources);
  return {
    texture: decodeCanvasTexture(properties),
    normalTexture: map(properties.normal_texture),
    specularTexture: map(properties.specular_texture),
  };
}

function surfaceOf(canvasTexture: CanvasTextureSlot): CanvasItemSurface | null {
  const fake = createFakeResourceLoader();
  let surface: CanvasItemSurface | null = null;
  render(
    <ResourceLoaderProvider loader={fake.loader}>
      <CanvasItemSurfaceSource
        slot={canvasTexture}
        sampler={SAMPLER}
        onSurface={(next) => (surface = next)}
      />
    </ResourceLoaderProvider>
  );
  return surface;
}

describe('CanvasItemSurfaceSource', () => {
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
      texture: decodeAtlasTexture({ region: 'Rect2(0, 0, 4, 8)' }),
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
    const nested = slot({ normal_texture: 'SubResource("CanvasTexture_inner")' }, [
      ...MAP,
      {
        id: 'CanvasTexture_inner',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("GradientTexture2D_flat")' },
      },
    ]);
    expect(surfaceOf(nested)).toBeNull();
  });

  it('hands null on unmount', () => {
    const onSurface = vi.fn();
    const view = render(
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <CanvasItemSurfaceSource
          slot={slot({ normal_texture: 'SubResource("GradientTexture2D_flat")' })}
          sampler={SAMPLER}
          onSurface={onSurface}
        />
      </ResourceLoaderProvider>
    );
    view.unmount();
    expect(onSurface).toHaveBeenLastCalledWith(null);
  });
});
