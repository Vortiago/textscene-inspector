import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import { useMeshAabb } from './meshAabb';

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: { size: 'Vector3(2, 2, 2)' } };
const ARRAY_MESH: TscnInternalResource = {
  id: 'array',
  type: 'ArrayMesh',
  data: { custom_aabb: 'AABB(0, 0, 0, 3, 4, 5)' },
};
const EXTERNAL: TscnExternalResource[] = [{ id: '1', type: 'ArrayMesh', path: 'res://rock.tres' }];
const RESOURCES: SceneResources = { internalResources: [BOX, ARRAY_MESH], externalResources: EXTERNAL };
const ROCK_AABB = { position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 3, z: 2 } };

function renderMeshAabb(meshRef: string | undefined, fake: FakeResourceLoader = createFakeResourceLoader()) {
  return renderHook(() => useMeshAabb(meshRef, RESOURCES), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  }).result;
}

describe('useMeshAabb', () => {
  it('bounds a scene PrimitiveMesh', () => {
    expect(renderMeshAabb('SubResource("box")').current?.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('takes a scene ArrayMesh’s box', () => {
    expect(renderMeshAabb('SubResource("array")').current?.size).toEqual({ x: 3, y: 4, z: 5 });
  });

  it('takes an external ArrayMesh’s box once it loads', () => {
    const fake = createFakeResourceLoader();
    const geometry = new THREE.BufferGeometry();
    fake.arrayMeshes.seed('res://rock.tres', {
      geometry,
      materialPaths: [],
      surfaceIndices: [],
      aabb: ROCK_AABB,
    });
    expect(renderMeshAabb('ExtResource("1")', fake).current).toBe(ROCK_AABB);
  });

  it('is unknown while an external ArrayMesh loads', () => {
    expect(renderMeshAabb('ExtResource("1")').current).toBeNull();
  });

  it('is unknown for no mesh', () => {
    expect(renderMeshAabb(undefined).current).toBeNull();
  });
});
