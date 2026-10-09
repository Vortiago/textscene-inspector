import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { useMultiMeshInstance3DAabb } from './ownAabb';

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: {} };

function multiMesh(data: Record<string, string>): TscnInternalResource {
  return { id: 'mm', type: 'MultiMesh', data };
}

function renderAabb(resources: TscnInternalResource[]) {
  const node: TscnNode = {
    name: 'Grass',
    type: 'MultiMeshInstance3D',
    rawProperties: { multimesh: 'SubResource("mm")' },
    children: [],
    properties: {},
  };
  return renderHook(() => useMultiMeshInstance3DAabb(node), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <SceneResourcesProvider internalResources={resources}>{children}</SceneResourcesProvider>
      </ResourceLoaderProvider>
    ),
  }).result.current;
}

describe('useMultiMeshInstance3DAabb', () => {
  it('bounds the mesh under each instance transform', () => {
    const data = {
      transform_format: '1',
      instance_count: '2',
      mesh: 'SubResource("box")',
      buffer: 'PackedFloat32Array(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 4, 0, 1, 0, 0, 0, 0, 1, 0)',
    };
    expect(renderAabb([BOX, multiMesh(data)])).toEqual({
      position: { x: -0.5, y: -0.5, z: -0.5 },
      size: { x: 5, y: 1, z: 1 },
    });
  });

  it('is unknown for a MultiMesh it cannot read', () => {
    const data = { instance_count: '1', mesh: 'SubResource("box")', buffer: 'PackedFloat32Array(1, x)' };
    expect(renderAabb([BOX, multiMesh(data)])).toBeNull();
  });

  it('is unknown when the reference names another resource type', () => {
    expect(renderAabb([{ ...BOX, id: 'mm' }])).toBeNull();
  });
});
