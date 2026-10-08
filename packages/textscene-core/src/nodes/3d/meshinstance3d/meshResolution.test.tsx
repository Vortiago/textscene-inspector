import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import { useMeshResolution } from './meshResolution';

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: {} };
const RESOURCES: SceneResources = {
  internalResources: [BOX],
  externalResources: [
    { id: '1', type: 'ArrayMesh', path: 'res:///meshes//rock.tres' },
    { id: '2', type: 'BoxMesh', path: 'res://crate.tres' },
    { id: '3', type: 'PackedScene', path: 'res://rock.glb' },
  ],
};

function seedFiles(fake: FakeResourceLoader): void {
  fake.resources.seed('res://meshes/rock.tres', {
    resourceType: 'ArrayMesh',
    properties: {},
    extResources: [],
    subResources: [],
  });
  fake.resources.seed('res://crate.tres', {
    resourceType: 'BoxMesh',
    properties: { size: 'Vector3(2, 2, 2)' },
    extResources: [],
    subResources: [],
  });
}

function renderResolution(
  meshRef: string | undefined,
  fake: FakeResourceLoader = createFakeResourceLoader()
) {
  return renderHook(() => useMeshResolution(meshRef, RESOURCES), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  }).result;
}

describe('useMeshResolution', () => {
  it('names the simplified .tres path of an external ArrayMesh', () => {
    const fake = createFakeResourceLoader();
    seedFiles(fake);
    expect(renderResolution('ExtResource("1")', fake).current.arrayMeshPath).toBe('res://meshes/rock.tres');
  });

  it('resolves an external PrimitiveMesh to its file’s resource, with no ArrayMesh path', () => {
    const fake = createFakeResourceLoader();
    seedFiles(fake);
    const resolution = renderResolution('ExtResource("2")', fake).current;
    expect(resolution.scoped?.resource.type).toBe('BoxMesh');
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('resolves a SubResource against the scene, with no ArrayMesh path', () => {
    const resolution = renderResolution('SubResource("box")').current;
    expect(resolution.scoped?.resource).toBe(BOX);
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('is pending while the .tres loads', () => {
    const resolution = renderResolution('ExtResource("2")').current;
    expect(resolution.status).toBe('pending');
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('is unavailable for a .glb or an unknown id', () => {
    expect(renderResolution('ExtResource("3")').current.status).toBe('unavailable');
    expect(renderResolution('ExtResource("9")').current.status).toBe('unavailable');
  });
});
