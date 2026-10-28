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
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { UV2_CHANNEL } from '../../resources/meshes/uv2';
import { GLTF_SURFACE, type TexturedSurface } from './surfaceTextures';
import { NodePathProvider } from '../contexts/NodePathContext';
import { copiesFilledFrom } from '../liveTargets.testkit';
import { unconfiguredViewportTexture } from '../../resources/textures/viewporttexture/unconfiguredViewportTexture';
import { inlineMaterial, unfadedProps } from './surfaceMaterial.testkit';
import { useSurfaceMaterial } from './useSurfaceMaterial';
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
 * The props a material with `properties` derives on `surface`, its references resolved in
 * `resources`, with the hook mounted inside `around`.
 */
function materialProps(
  properties: Record<string, string>,
  resources: TscnInternalResource[],
  surface?: TexturedSurface,
  around: (children: ReactNode) => ReactNode = (children) => children
): THREE.MeshPhysicalMaterialParameters {
  const source = inlineMaterial(properties, resources);
  const { loader } = createFakeResourceLoader();
  const { result } = renderHook(() => useSurfaceMaterial(source, surface), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={loader}>{around(children)}</ResourceLoaderProvider>
    ),
  });
  return unfadedProps(result.current);
}

/** The emission map a material with `properties` binds on `surface`. */
function emissionMap(properties: Record<string, string>, surface?: TexturedSurface): THREE.Texture {
  const emission = { emission_enabled: 'true', emission_texture: 'SubResource("GradientTexture2D_a")' };
  return materialProps({ ...emission, ...properties }, GRADIENT, surface).emissiveMap!;
}

describe('useSurfaceMaterial on a glTF surface', () => {
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

  it("scales a Godot mesh's map from its top edge, as Godot's top-down V does", () => {
    const map = emissionMap({ uv1_scale: 'Vector3(2, 1.5, 1)' });

    expect([map.repeat.y, map.offset.y]).toEqual([1.5, -0.5]);
  });

  it("moves a Godot mesh's map down the image for a positive V offset", () => {
    const map = emissionMap({ uv1_offset: 'Vector3(0.5, 0.25, 0)' });

    expect([map.offset.x, map.offset.y]).toEqual([0.5, -0.25]);
  });

  it("flips a Godot mesh's UV2 map, as its UV2 keeps the top-down V", () => {
    const map = emissionMap({ emission_on_uv2: 'true' });

    expect([map.channel, map.repeat.y, map.offset.y]).toEqual([UV2_CHANNEL, -1, 1]);
  });
});

const VIEWPORT: TscnInternalResource[] = [
  { id: 'ViewportTexture_a', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
];

/** The props a material whose albedo is the SubViewport's render target derives on `surface`. */
function viewportProps(properties: Record<string, string>, surface?: TexturedSurface) {
  return targetProps({ albedo_texture: 'SubResource("ViewportTexture_a")', ...properties }, surface);
}

/** A render target's texture, which the publisher marks live. */
function renderTargetTexture(): THREE.Texture {
  return new THREE.WebGLRenderTarget(4, 4).texture;
}

/**
 * The props a material with `properties`, which name the SubViewport's render target, derives. The
 * target publishes a decoding view apart from its plain view, as a canvas-content target does.
 */
function targetProps(properties: Record<string, string>, surface?: TexturedSurface) {
  const target = renderTargetTexture();
  const decoding = renderTargetTexture();
  const { view, retainers } = countingView(decoding);
  const props = materialProps(
    { resource_local_to_scene: 'true', ...properties },
    VIEWPORT,
    surface,
    (children) => (
      <ViewportTextureProvider>
        <ViewportTexturePublisher
          path="Root/SubViewport"
          entry={viewportEntry(target, { x: 4, y: 4 }, { decoding: view })}
        />
        <NodePathProvider path="Root/Mesh">{children}</NodePathProvider>
      </ViewportTextureProvider>
    )
  );
  return { props, target, decoding, retainers };
}

describe('useSurfaceMaterial with a render-target albedo', () => {
  /** A `source_color` sampler reads the sRGB view (`material_storage.cpp:1067,1073`). */
  it('binds its own copy of the decoding view, which the pass fills', () => {
    const { props, decoding } = viewportProps({});

    expect(copiesFilledFrom(decoding)).toEqual([props.map]);
  });

  it('samples its copy through the UV1 transform', () => {
    const { props } = viewportProps({ uv1_scale: 'Vector3(2, 3, 1)' });

    expect([props.map!.repeat.x, props.map!.repeat.y]).toEqual([2, 3]);
  });

  it("flips the copy's V on a glTF surface, as for any other map", () => {
    const { props } = viewportProps({}, GLTF_SURFACE);

    expect([props.map!.repeat.y, props.map!.offset.y]).toEqual([-1, 1]);
  });

  it('samples its copy with the nearest filter that `texture_filter` names', () => {
    const { props } = viewportProps({ texture_filter: '0' });

    expect(props.map!.magFilter).toBe(THREE.NearestFilter);
  });

  it('clamps its copy when `texture_repeat` is off (edge case)', () => {
    const { props } = viewportProps({ texture_repeat: 'false' });

    expect(props.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('patches no program to sample the target, as each slot reads its own copy', () => {
    const { props } = viewportProps({ uv1_scale: 'Vector3(2, 3, 1)' });

    expect(Object.keys(props.userData ?? {}).some((key) => key.includes('Target'))).toBe(false);
  });
});

describe('useSurfaceMaterial with a ViewportTexture Godot never sets up', () => {
  /**
   * `make_local_resource` sets up a material only when it is local to scene, and only then its
   * ViewportTexture (`packed_scene.cpp:701-704`, `core/io/resource.cpp:497-503`).
   */
  it('binds the placeholder in a material that is not local to scene', () => {
    const { props } = targetProps({
      resource_local_to_scene: 'false',
      albedo_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(props.map!.image).toBe(unconfiguredViewportTexture().image);
  });
});

describe('useSurfaceMaterial with a render target in another slot', () => {
  it('binds its own copy of the decoding view in an emission slot, a `source_color` sampler too', () => {
    const { props, decoding } = targetProps({
      emission_enabled: 'true',
      emission_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(copiesFilledFrom(decoding)).toEqual([props.emissiveMap]);
  });

  it('keeps the decoding view filled while a `source_color` slot binds it', () => {
    const { retainers } = viewportProps({});

    expect(retainers.count).toBe(1);
  });

  it('binds its own copy of the plain view in a normal slot, which reads raw', () => {
    const { props, target } = targetProps({
      normal_enabled: 'true',
      normal_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(copiesFilledFrom(target)).toEqual([props.normalMap]);
  });

  it('fills no decoding view for a slot that reads raw (edge case)', () => {
    const { retainers } = targetProps({
      normal_enabled: 'true',
      normal_texture: 'SubResource("ViewportTexture_a")',
    });

    expect(retainers.count).toBe(0);
  });

  it('samples an emission copy through the UV1 transform, as the albedo does', () => {
    const { props } = targetProps({
      emission_enabled: 'true',
      emission_texture: 'SubResource("ViewportTexture_a")',
      uv1_scale: 'Vector3(2, 3, 1)',
    });

    expect([props.emissiveMap!.repeat.x, props.emissiveMap!.repeat.y]).toEqual([2, 3]);
  });
});
