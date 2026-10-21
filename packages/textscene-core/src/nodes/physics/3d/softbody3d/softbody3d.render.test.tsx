/** A SoftBody3D at rest draws its `mesh` as a MeshInstance3D does, with no simulation. */

import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import type { TscnNode } from '../../../../parser/types';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { subResource } from '../../../../testing/subResource';
import { findMesh } from '../../../3d/testing/reactThreeTestInstance';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';
import { renderMeshInstance } from '../../../3d/meshinstance3d/testing/renderMeshInstance';
import './index.r3f';

const INTERNAL_RESOURCES = [
  subResource('PlaneMesh', 'cloth', { size: 'Vector2(4, 2)' }),
  subResource('StandardMaterial3D', 'red', { albedo_color: 'Color(1, 0, 0, 1)' }),
];

function softBodyNode(rawProperties: Record<string, string>): TscnNode {
  return {
    name: 'Cloth',
    type: 'SoftBody3D',
    rawProperties,
    children: [],
    properties: parseMeshInstance3D(heading('SoftBody3D', { name: 'Cloth' }), rawProperties),
  };
}

async function renderSoftBody(rawProperties: Record<string, string>) {
  const { loader } = createFakeResourceLoader();
  const renderer = await renderMeshInstance({
    loader,
    node: softBodyNode(rawProperties),
    internalResources: INTERNAL_RESOURCES,
  });
  return findMesh(renderer.scene);
}

describe('<SoftBody3D>', () => {
  it('draws its mesh at rest', async () => {
    const mesh = await renderSoftBody({ mesh: 'SubResource("cloth")' });
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    expect([max.x - min.x, max.y - min.y, max.z - min.z]).toEqual([4, 0, 2]);
  });

  it('draws nothing with no mesh', async () => {
    const mesh = await renderSoftBody({});
    expect(mesh.geometry.attributes.position).toBeUndefined();
  });
});
