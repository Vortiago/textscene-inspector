/**
 * A StandardMaterial3D slot binds a texture by its RID: an AtlasTexture binds its whole sheet
 * (`scene/resources/atlas_texture.cpp:55-58`), a `.tres` the texture it saves, and a CanvasTexture,
 * whose RID names no texture, Godot's white default (`material_storage.cpp:1094-1096`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseTresFile } from '../../parser/parsedResource';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { resetProceduralTextures } from '../../resources/textures/proceduralBuilds';
import { defaultWhiteTexture } from './defaultWhiteTexture';
import { pendingMapStandIn } from './pendingMapStandIn';
import { useMaterialTextures } from './SurfaceMaterialSlot';

const SHEET_PATH = 'res://sheet.png';
const TRES_PATH = 'res://ramp.tres';
const EXTERNAL: TscnExternalResource[] = [
  { id: '1_sheet', type: 'Texture2D', path: SHEET_PATH },
  { id: '2_tres', type: 'Texture2D', path: TRES_PATH },
];

const INTERNAL: TscnInternalResource[] = [
  {
    id: 'AtlasTexture_cell',
    type: 'AtlasTexture',
    data: { atlas: 'ExtResource("1_sheet")', region: 'Rect2(0, 0, 2, 2)' },
  },
  { id: 'CanvasTexture_a', type: 'CanvasTexture', data: { diffuse_texture: 'ExtResource("1_sheet")' } },
  { id: 'Gradient_a', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
  {
    id: 'GradientTexture2D_a',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
  },
  {
    id: 'AtlasTexture_gradient',
    type: 'AtlasTexture',
    data: { atlas: 'SubResource("GradientTexture2D_a")', region: 'Rect2(0, 0, 4, 4)' },
  },
];

const GRADIENT_TRES = parseTresFile(`[gd_resource type="GradientTexture2D" format=3]

[sub_resource type="Gradient" id="Gradient_b"]
colors = PackedColorArray(0, 0, 0, 1, 1, 1, 1, 1)

[resource]
gradient = SubResource("Gradient_b")
width = 4
height = 4
`);

function renderMaterial(
  properties: Record<string, string>,
  seed?: (fake: ReturnType<typeof createFakeResourceLoader>) => void
) {
  const fake = createFakeResourceLoader();
  seed?.(fake);
  const scalars = parseStandardMaterial3DScalars(properties);
  const hook = renderHook(
    () => useMaterialTextures(scalars, { internalResources: INTERNAL, externalResources: EXTERNAL }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      ),
    }
  );
  return { ...hook, fake };
}

function sheet(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
}

afterEach(() => {
  resetProceduralTextures();
});

describe('useMaterialTextures with a wrapped or saved texture', () => {
  it("binds an AtlasTexture's whole sheet, uncropped", () => {
    const { result, fake } = renderMaterial({ albedo_texture: 'SubResource("AtlasTexture_cell")' });
    const loaded = sheet();
    act(() => fake.textures._resolve(SHEET_PATH, loaded));

    const map = result.current.maps.albedoMap!;
    expect(map.source).toBe(loaded.source);
    expect(map.image).toMatchObject({ width: 4, height: 4 });
  });

  it("binds an AtlasTexture's procedural sheet, uncropped", () => {
    const { result } = renderMaterial({ albedo_texture: 'SubResource("AtlasTexture_gradient")' });

    expect(result.current.maps.albedoMap?.image).toMatchObject({ width: 8, height: 8 });
  });

  it("binds Godot's white default for a CanvasTexture, whose RID names no texture", () => {
    const { result, fake } = renderMaterial({ albedo_texture: 'SubResource("CanvasTexture_a")' });
    act(() => fake.textures._resolve(SHEET_PATH, sheet()));

    expect(result.current.maps.albedoMap).toBe(defaultWhiteTexture());
    expect(result.current.isUnresolved).toBe(false);
  });

  it("binds Godot's white default in an emission slot too, whatever its hint (edge case)", () => {
    const { result } = renderMaterial({
      emission_enabled: 'true',
      emission_texture: 'SubResource("CanvasTexture_a")',
    });

    expect(result.current.maps.emissiveMap).toBe(defaultWhiteTexture());
  });

  it('binds a stand-in while a .tres texture loads', () => {
    const { result } = renderMaterial({ albedo_texture: 'ExtResource("2_tres")' });

    expect(result.current.maps.albedoMap).toBe(pendingMapStandIn('albedo_texture'));
    expect(result.current.isUnresolved).toBe(false);
  });

  it('binds the texture a .tres saves', () => {
    const { result } = renderMaterial({ albedo_texture: 'ExtResource("2_tres")' }, (fake) =>
      fake.resources.seed(TRES_PATH, GRADIENT_TRES)
    );

    expect(result.current.maps.albedoMap?.image).toMatchObject({ width: 4, height: 4 });
  });

  it("reports the surface unresolved once an AtlasTexture's sheet fails (error case)", () => {
    const { result, fake } = renderMaterial({ albedo_texture: 'SubResource("AtlasTexture_cell")' });
    act(() => fake.textures._fail(SHEET_PATH, 'not found'));

    expect(result.current.maps.albedoMap).toBeUndefined();
    expect(result.current.isUnresolved).toBe(true);
  });
});
