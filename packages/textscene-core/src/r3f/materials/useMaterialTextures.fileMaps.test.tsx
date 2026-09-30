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
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { pendingMapStandIn } from './pendingMapStandIn';
import { useMaterialTextures } from './SurfaceMaterialSlot';

const NORMAL_PATH = 'res://bricks_normal.png';
const EXTERNAL: TscnExternalResource[] = [{ id: '1_normal', type: 'Texture2D', path: NORMAL_PATH }];

const SCALARS = parseStandardMaterial3DScalars({
  normal_enabled: 'true',
  normal_texture: 'ExtResource("1_normal")',
});

function renderMaterial() {
  const fake = createFakeResourceLoader();
  const hook = renderHook(
    () => useMaterialTextures(SCALARS, { internalResources: [], externalResources: EXTERNAL }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      ),
    }
  );
  return { ...hook, textures: fake.textures };
}

describe('useMaterialTextures with file slots', () => {
  it('binds a stand-in while the file loads', () => {
    const { result } = renderMaterial();

    expect(result.current.maps.normalMap).toBe(pendingMapStandIn('normal_texture'));
    expect(result.current.firstMissingPath).toBeNull();
  });

  it('binds the file once it loads', () => {
    const { result, textures } = renderMaterial();
    const loaded = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    act(() => textures._resolve(NORMAL_PATH, loaded));

    expect(result.current.maps.normalMap?.source).toBe(loaded.source);
  });

  it('leaves the slot empty and names the file once it fails', () => {
    const { result, textures } = renderMaterial();
    act(() => textures._fail(NORMAL_PATH, 'not found'));

    expect(result.current.maps.normalMap).toBeUndefined();
    expect(result.current.firstMissingPath).toBe(NORMAL_PATH);
  });
});
