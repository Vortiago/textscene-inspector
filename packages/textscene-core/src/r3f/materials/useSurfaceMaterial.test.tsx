/**
 * What `useSurfaceMaterial` answers for a source: nothing to replace, the placeholder for a texture
 * that never draws, or the two bags. Every texture slot goes through one path, the anisotropy
 * flowmap included.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { standardMaterialBags } from '../../resources/materials/standardmaterial3d/materialBag';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { fakeTiledUploads } from '../tiledUpload/fakeTiledUploads.testkit';
import { inlineMaterialSource, type MaterialSource } from './materialSource';
import { subResource } from '../../testing/subResource';
import { pendingMapStandIn } from './pendingMapStandIn';
import { inlineMaterial, unfadedProps } from './surfaceMaterial.testkit';
import { useSurfaceMaterial } from './useSurfaceMaterial';

const TRES_PATH = 'res://painted.tres';
const PAINT_TRES = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nroughness = 0.25\n';
const FLOWMAP_PATH = 'res://flow.png';
const EXTERNAL: TscnExternalResource[] = [{ id: '1_flow', type: 'Texture2D', path: FLOWMAP_PATH }];

function renderSurface(source: MaterialSource | undefined, withUploads = false) {
  const fake = createFakeResourceLoader();
  const uploads = fakeTiledUploads();
  const hook = renderHook(() => useSurfaceMaterial(source), {
    wrapper: ({ children }: { children: ReactNode }) => {
      const tree = <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
      return withUploads ? <uploads.wrapper>{tree}</uploads.wrapper> : tree;
    },
  });
  return { ...hook, fake, uploads: uploads.pending };
}

/** A 1x1 flowmap whose alpha, Godot's strength, is 200. */
function flowmap(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([10, 20, 30, 200]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

async function finish(uploads: { finish(uploaded: boolean): void }[]) {
  await act(async () => {
    uploads.forEach((upload) => upload.finish(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useSurfaceMaterial for a source without a usable material', () => {
  it('is absent with no source, so nothing replaces what the surface had', () => {
    const { result } = renderSurface(undefined);

    expect(result.current.isAbsent).toBe(true);
  });

  it('is absent while a material file loads, then draws its scalars', () => {
    const { result, fake } = renderSurface({ kind: 'file', path: TRES_PATH });
    expect(result.current.isAbsent).toBe(true);

    act(() => fake.resources._resolve(TRES_PATH, parseTresFile(PAINT_TRES)));

    expect(result.current.isAbsent).toBe(false);
    expect(result.current.scalars?.roughness).toBe(0.25);
  });

  it("derives Godot's default surface for a material type it does not build", () => {
    const { result } = renderSurface(inlineMaterialSource(subResource('ShaderMaterial', 'Shader_a'), [], []));

    expect(result.current.isAbsent).toBe(false);
    expect(result.current.scalars).toBeNull();
    expect(result.current.bags?.unfaded.materialClass).toBe(standardMaterialBags(null).unfaded.materialClass);
  });
});

describe('useSurfaceMaterial bags', () => {
  it('keeps the same bags through a re-render that changes nothing', () => {
    const { result, rerender } = renderSurface(inlineMaterial({ roughness: '0.3' }));
    const first = result.current.bags;

    rerender();

    expect(result.current.bags).toBe(first);
  });

  it('starts no upload for a material with no maps, whose slots are all empty', () => {
    const { uploads } = renderSurface(inlineMaterial({ roughness: '0.3' }), true);

    expect(uploads).toHaveLength(0);
  });
});

describe('useSurfaceMaterial with an anisotropy flowmap', () => {
  const ANISOTROPIC = {
    anisotropy_enabled: 'true',
    anisotropy: '0.8',
    anisotropy_flowmap: 'ExtResource("1_flow")',
  };

  it('repacks the flowmap strength into blue, where three reads it', () => {
    const { result, fake } = renderSurface(inlineMaterial(ANISOTROPIC, [], EXTERNAL));
    act(() => fake.textures._resolve(FLOWMAP_PATH, flowmap()));

    const image = unfadedProps(result.current).anisotropyMap?.image as { data: Uint8Array };
    expect([...image.data]).toEqual([10, 20, 200, 200]);
  });

  it('binds a stand-in while the flowmap loads, as every other slot does', () => {
    const { result } = renderSurface(inlineMaterial(ANISOTROPIC, [], EXTERNAL));

    expect(unfadedProps(result.current).anisotropyMap).toBe(pendingMapStandIn('anisotropy_flowmap'));
  });

  it('uploads the repacked flowmap in bands before drawing it', async () => {
    const { result, fake, uploads } = renderSurface(inlineMaterial(ANISOTROPIC, [], EXTERNAL), true);
    act(() => fake.textures._resolve(FLOWMAP_PATH, flowmap()));
    expect(unfadedProps(result.current).anisotropyMap).toBe(pendingMapStandIn('anisotropy_flowmap'));
    expect(uploads).toHaveLength(1);

    await finish(uploads);

    expect(unfadedProps(result.current).anisotropyMap).toBeInstanceOf(THREE.DataTexture);
    expect(unfadedProps(result.current).anisotropyMap).not.toBe(pendingMapStandIn('anisotropy_flowmap'));
  });

  it('starts no upload for a flowmap the material never samples (edge case)', () => {
    const { fake, uploads } = renderSurface(
      inlineMaterial({ ...ANISOTROPIC, anisotropy: '0' }, [], EXTERNAL),
      true
    );
    act(() => fake.textures._resolve(FLOWMAP_PATH, flowmap()));

    expect(uploads).toHaveLength(0);
  });

  it('binds no stand-in for a flowmap the material never samples (edge case)', () => {
    const { result } = renderSurface(inlineMaterial({ ...ANISOTROPIC, anisotropy: '0' }, [], EXTERNAL));

    expect(unfadedProps(result.current).anisotropyMap).toBeUndefined();
  });
});
