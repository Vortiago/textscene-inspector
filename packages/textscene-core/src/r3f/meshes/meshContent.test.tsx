import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../../parser/types';
import type { SceneResources } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { useResourceResolution } from '../../resources/useSubOrExtResource';
import { NodePathProvider } from '../contexts/NodePathContext';
import { UndrawnMeshesProvider, useUndrawnMeshTypes } from '../contexts/UndrawnMeshesContext';
import { arrayMeshPath, useMeshContent } from './meshContent';

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
  return renderHook(
    () => {
      const resolution = useResourceResolution(meshRef, RESOURCES);
      return { ...resolution, arrayMeshPath: arrayMeshPath(resolution) };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      ),
    }
  ).result;
}

describe('arrayMeshPath over a mesh reference', () => {
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

/** Runs `hook` inside the node at `nodePath`, under a provider that collects undrawn mesh types. */
function renderUnderNode<T>(nodePath: string, hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <UndrawnMeshesProvider>
        <NodePathProvider path={nodePath}>{children}</NodePathProvider>
      </UndrawnMeshesProvider>
    ),
  });
}

describe('useMeshContent for a mesh type no slice builds', () => {
  const TEXT: TscnInternalResource = { id: 'text', type: 'TextMesh', data: {} };
  const SCENE: SceneResources = { internalResources: [TEXT], externalResources: [] };

  it("names the type in the holding node's details", () => {
    const { result } = renderUnderNode('Root/Sign', () => {
      useMeshContent(useResourceResolution('SubResource("text")', SCENE));
      return useUndrawnMeshTypes('Root/Sign');
    });
    expect(result.current).toEqual(['TextMesh']);
  });
});

describe('useMeshContent for a mesh with no surfaces', () => {
  const PLACEHOLDER: TscnInternalResource = { id: 'placeholder', type: 'PlaceholderMesh', data: {} };
  const SCENE: SceneResources = { internalResources: [PLACEHOLDER], externalResources: [] };

  it('is empty, as Godot draws nothing, and names no undrawn type', () => {
    const { result } = renderUnderNode('Root/Stand', () => ({
      content: useMeshContent(useResourceResolution('SubResource("placeholder")', SCENE)),
      undrawn: useUndrawnMeshTypes('Root/Stand'),
    }));
    expect(result.current).toEqual({ content: { kind: 'empty' }, undrawn: [] });
  });
});
