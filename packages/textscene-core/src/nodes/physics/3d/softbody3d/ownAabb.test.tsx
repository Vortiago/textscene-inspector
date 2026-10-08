import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { heading } from '../../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';
import { useSoftBody3DAabb } from './ownAabb';

const CLOTH: TscnInternalResource = { id: 'cloth', type: 'PlaneMesh', data: { size: 'Vector2(4, 2)' } };

function renderAabb(rawProperties: Record<string, string>) {
  const node: TscnNode = {
    name: 'Cloth',
    type: 'SoftBody3D',
    rawProperties,
    children: [],
    properties: parseMeshInstance3D(heading('SoftBody3D', { name: 'Cloth' }), rawProperties),
  };
  return renderHook(() => useSoftBody3DAabb(node), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <SceneResourcesProvider internalResources={[CLOTH]}>{children}</SceneResourcesProvider>
      </ResourceLoaderProvider>
    ),
  }).result.current;
}

describe('useSoftBody3DAabb', () => {
  it('takes its mesh’s box at rest', () => {
    const size = renderAabb({ mesh: 'SubResource("cloth")' })!.size;
    expect([size.x, size.y, size.z].map((side) => Number(side.toFixed(6)))).toEqual([4, 0, 2]);
  });

  it('is unknown for a mesh the scene lacks', () => {
    expect(renderAabb({ mesh: 'SubResource("gone")' })).toBeNull();
  });

  it('is unknown with no mesh, which leaves it no base', () => {
    expect(renderAabb({})).toBeNull();
  });
});
