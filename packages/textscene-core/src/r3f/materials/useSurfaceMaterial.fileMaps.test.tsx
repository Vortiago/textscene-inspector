/**
 * A StandardMaterial3D slot that names a texture file binds a stand-in while the file
 * loads, so the material links its program once, with the slot filled. A file that
 * fails leaves the slot empty and names itself as missing.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import type { TscnExternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { pendingMapStandIn } from './pendingMapStandIn';
import { inlineMaterial, unfadedProps } from './surfaceMaterial.testkit';
import { useSurfaceMaterial } from './useSurfaceMaterial';

const NORMAL_PATH = 'res://bricks_normal.png';
const EXTERNAL: TscnExternalResource[] = [{ id: '1_normal', type: 'Texture2D', path: NORMAL_PATH }];

const SOURCE = inlineMaterial(
  { normal_enabled: 'true', normal_texture: 'ExtResource("1_normal")' },
  [],
  EXTERNAL
);

function renderMaterial() {
  const fake = createFakeResourceLoader();
  const hook = renderHook(() => useSurfaceMaterial(SOURCE), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  });
  return { ...hook, textures: fake.textures };
}

describe('useSurfaceMaterial with file slots', () => {
  it('binds a stand-in while the file loads', () => {
    const { result } = renderMaterial();

    expect(unfadedProps(result.current).normalMap).toBe(pendingMapStandIn('normal_texture'));
    expect(result.current.bags).not.toBeNull();
  });

  it('binds the file once it loads', () => {
    const { result, textures } = renderMaterial();
    const loaded = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    act(() => textures._resolve(NORMAL_PATH, loaded));

    expect(unfadedProps(result.current).normalMap?.source).toBe(loaded.source);
  });

  it('tiles a clamped file on a source-shared Repeat clone for a default material', () => {
    // The loader hands clamp and a default material asks for Repeat (ADR-0044),
    // so the slot binds a clone and the shared entry keeps the loader's wrapping.
    const { result, textures } = renderMaterial();
    const loaded = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    act(() => textures._resolve(NORMAL_PATH, loaded));

    const map = unfadedProps(result.current).normalMap!;
    expect(map).not.toBe(loaded);
    expect(map.source).toBe(loaded.source);
    expect(map.wrapS).toBe(THREE.RepeatWrapping);
    expect(map.wrapT).toBe(THREE.RepeatWrapping);
    expect(loaded.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(loaded.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('derives no bags once the file fails, so the surface draws the missing-texture placeholder', () => {
    const { result, textures } = renderMaterial();
    act(() => textures._fail(NORMAL_PATH, 'not found'));

    expect(result.current.bags).toBeNull();
  });
});
