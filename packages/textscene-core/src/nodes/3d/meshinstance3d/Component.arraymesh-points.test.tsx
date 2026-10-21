/** An ArrayMesh with a POINTS surface draws as THREE.Points, as a PointMesh does (`Mesh.PRIMITIVE_POINTS`). */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

const POINTS_SURFACES = wallQuadSurfaces({ name: 'dots', primitive: 0 });

async function render() {
  return renderMeshInstance({
    loader: loaderServing(),
    node: meshInstanceNode({ mesh: 'SubResource("Dots")' }),
    internalResources: [subResource('ArrayMesh', 'Dots', { _surfaces: POINTS_SURFACES })],
  });
}

describe('MeshInstance3D with an ArrayMesh of points', () => {
  it('draws one THREE.Points over the surface’s four vertices, and no triangle mesh', async () => {
    const renderer = await render();
    const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));

    expect(points.geometry.getAttribute('position').count).toBe(4);
    expect(renderer.scene.findAllByType('Mesh')).toEqual([]);
  });
});
