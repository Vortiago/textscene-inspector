/**
 * The surface a material's textures draw on: a glTF surface keeps Godot's top-down V in its UVs,
 * as every UV2 attribute does, while every bound texture uploads bottom-up, so those maps sample
 * `1 - v`.
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
import { NodePathProvider } from '../contexts/NodePathContext';
import type { MaterialTextureMaps } from './materialTextureMaps';
import { ViewportTextureProvider } from '../contexts/ViewportTextureContext';
import { ViewportTexturePublisher, countingView, viewportEntry } from '../testing/ViewportTexturePublisher';

const GRADIENT: TscnInternalResource[] = [
  { id: 'Gradient_a', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
  {
    id: 'GradientTexture2D_a',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
  },
];

/**
 * The maps a material with `properties` binds on `surface`, its references resolved in
 * `resources`, with the hook mounted inside `around`.
 */
function materialMaps(
  properties: Record<string, string>,
  resources: TscnInternalResource[],
  surface?: TexturedSurface,
  around: (children: ReactNode) => ReactNode = (children) => children
): MaterialTextureMaps {
  const scalars = parseStandardMaterial3DScalars(properties);
  const { loader } = createFakeResourceLoader();
  const { result } = renderHook(
    () => useMaterialTextures(scalars, { internalResources: resources, externalResources: [] }, surface),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>{around(children)}</ResourceLoaderProvider>
      ),
    }
  );
  return result.current.maps;
}

/** The emission map a material with `properties` binds on `surface`. */
function emissionMap(properties: Record<string, string>, surface?: TexturedSurface): THREE.Texture {
  const emission = { emission_enabled: 'true', emission_texture: 'SubResource("GradientTexture2D_a")' };
  return materialMaps({ ...emission, ...properties }, GRADIENT, surface).emissiveMap!;
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

  it('flips a UV2 map once, whose cached UV2 keeps the top-down V', () => {
    const map = emissionMap({ emission_on_uv2: 'true' }, GLTF_SURFACE);

    expect([map.channel, map.repeat.y, map.offset.y]).toEqual([UV2_CHANNEL, -1, 1]);
  });

  it("flips a triplanar UV2 map, which reads the glTF's first UV set", () => {
    const map = emissionMap({ emission_on_uv2: 'true', uv2_triplanar: 'true' }, GLTF_SURFACE);

    expect([map.channel, map.repeat.y, map.offset.y]).toEqual([0, -1, 1]);
  });

  it("keeps a Godot mesh's map unflipped, as its UVs are bottom-up (edge case)", () => {
    const map = emissionMap({});

    expect([map.repeat.y, map.offset.y]).toEqual([1, 0]);
  });

  it("flips a Godot mesh's UV2 map, as its UV2 keeps the top-down V", () => {
    const map = emissionMap({ emission_on_uv2: 'true' });

    expect([map.channel, map.repeat.y, map.offset.y]).toEqual([UV2_CHANNEL, -1, 1]);
  });
});

const VIEWPORT: TscnInternalResource[] = [
  { id: 'ViewportTexture_a', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
];

/** The maps a material whose albedo is the SubViewport's render target binds on `surface`. */
function viewportMaps(properties: Record<string, string>, surface?: TexturedSurface) {
  return targetMaps({ albedo_texture: 'SubResource("ViewportTexture_a")', ...properties }, surface);
}

/**
 * The maps a material with `properties`, which name the SubViewport's render target, binds. The
 * target publishes a decoding view apart from its plain view, as a canvas-content target does.
 */
function targetMaps(properties: Record<string, string>, surface?: TexturedSurface) {
  const target = new THREE.WebGLRenderTarget(4, 4).texture;
  const decoding = new THREE.WebGLRenderTarget(4, 4).texture;
  const { view, retainers } = countingView(decoding);
  const maps = materialMaps(properties, VIEWPORT, surface, (children) => (
    <ViewportTextureProvider>
      <ViewportTexturePublisher
        path="Root/SubViewport"
        entry={viewportEntry(target, { x: 4, y: 4 }, { decoding: view })}
      />
      <NodePathProvider path="Root/Mesh">{children}</NodePathProvider>
    </ViewportTextureProvider>
  ));
  return { maps, target, decoding, retainers };
}

describe('useMaterialTextures with a render-target albedo', () => {
  /** A `source_color` sampler reads the sRGB view (`material_storage.cpp:1067,1073`). */
  it('binds the decoding view and hands its UV transform to the material', () => {
    const { maps, decoding } = viewportMaps({ uv1_scale: 'Vector3(2, 3, 1)' });

    expect(maps.albedoMap).toBe(decoding);
    expect(maps.albedoTargetUv).toEqual({ scale: { x: 2, y: 3 }, offset: { x: 0, y: 0 } });
  });

  it("flips the target's V on a glTF surface, as for any other map", () => {
    const { maps } = viewportMaps({}, GLTF_SURFACE);

    expect(maps.albedoTargetUv).toEqual({ scale: { x: 1, y: -1 }, offset: { x: 0, y: 1 } });
  });

  it('hands no UV transform for a file albedo, which carries its own (edge case)', () => {
    const maps = materialMaps({ albedo_texture: 'SubResource("GradientTexture2D_a")' }, GRADIENT);

    expect(maps.albedoTargetUv).toBeUndefined();
  });
});

describe('useMaterialTextures with a render target in another slot', () => {
  it('binds the decoding view in an emission slot, a `source_color` sampler too', () => {
    const { maps, decoding } = targetMaps({
      emission_enabled: 'true',
      emission_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(maps.emissiveMap).toBe(decoding);
  });

  it('keeps the decoding view filled while a `source_color` slot binds it', () => {
    const { retainers } = viewportMaps({});

    expect(retainers.count).toBe(1);
  });

  it('binds the plain view in a normal slot, which reads raw', () => {
    const { maps, target } = targetMaps({
      normal_enabled: 'true',
      normal_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(maps.normalMap).toBe(target);
  });

  it('fills no decoding view for a slot that reads raw (edge case)', () => {
    const { retainers } = targetMaps({
      normal_enabled: 'true',
      normal_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(retainers.count).toBe(0);
  });

  it('hands the albedo UV transform to no other slot (edge case)', () => {
    const { maps } = targetMaps({
      emission_enabled: 'true',
      emission_texture: 'SubResource("ViewportTexture_a")',
      uv1_scale: 'Vector3(2, 3, 1)',
    });

    expect(maps.albedoTargetUv).toBeUndefined();
  });
});
