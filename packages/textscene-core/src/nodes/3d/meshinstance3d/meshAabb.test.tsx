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
const EXTERNAL: TscnExternalResource[] = [
  { id: '1', type: 'ArrayMesh', path: 'res://rock.tres' },
  { id: '2', type: 'BoxMesh', path: 'res://crate.tres' },
];
const PLACEHOLDER: TscnInternalResource = {
  id: 'placeholder',
  type: 'PlaceholderMesh',
  data: { aabb: 'AABB(-1, 0, -1, 2, 6, 2)' },
};
const IMMEDIATE: TscnInternalResource = { id: 'immediate', type: 'ImmediateMesh', data: {} };
const RESOURCES: SceneResources = {
  internalResources: [BOX, ARRAY_MESH, PLACEHOLDER, IMMEDIATE],
  externalResources: EXTERNAL,
};

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

  it('takes an external ArrayMesh’s box from the ArrayMesh processor once it loads', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://rock.tres', {
      resourceType: 'ArrayMesh',
      properties: {},
      extResources: [],
      subResources: [],
    });
    const rockAabb = { position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 3, z: 2 } };
    fake.arrayMeshes.seed('res://rock.tres', {
      geometry: new THREE.BufferGeometry(),
      materialPaths: [],
      surfaceIndices: [],
      aabb: rockAabb,
    });
    expect(renderMeshAabb('ExtResource("1")', fake).current).toBe(rockAabb);
  });

  it('bounds an external PrimitiveMesh once it loads', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://crate.tres', {
      resourceType: 'BoxMesh',
      properties: { size: 'Vector3(4, 4, 4)' },
      extResources: [],
      subResources: [],
    });
    expect(renderMeshAabb('ExtResource("2")', fake).current?.size).toEqual({ x: 4, y: 4, z: 4 });
  });

  it('is unknown while an external ArrayMesh loads', () => {
    expect(renderMeshAabb('ExtResource("1")').current).toBeNull();
  });

  it('is unknown for no mesh', () => {
    expect(renderMeshAabb(undefined).current).toBeNull();
  });
});

describe('useMeshAabb over a mesh with no surfaces', () => {
  // A PlaceholderMesh answers its own `aabb` (`scene/resources/mesh.h:430`).
  it('takes a PlaceholderMesh’s aabb', () => {
    expect(renderMeshAabb('SubResource("placeholder")').current?.size).toEqual({ x: 2, y: 6, z: 2 });
  });

  // An ImmediateMesh saves no surface, so it loads with none (`immediate_mesh.cpp:393-401,405-417`).
  it('is AABB() for an ImmediateMesh', () => {
    expect(renderMeshAabb('SubResource("immediate")').current?.size).toEqual({ x: 0, y: 0, z: 0 });
  });
});
