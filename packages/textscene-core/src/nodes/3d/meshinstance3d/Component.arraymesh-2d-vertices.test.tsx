/**
 * An ArrayMesh whose surface holds 2D vertices (`ARRAY_FLAG_USE_2D_VERTICES`), which the editor's
 * "Convert to MeshInstance2D" writes, draws in a MeshInstance3D too, in its z = 0 plane. Its
 * vertex colours decode and ride on the geometry, where a material that asks for them reads them.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { colouredQuadSurface, quad2DVerticesSurface } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

async function geometryOf(surface: string): Promise<THREE.BufferGeometry> {
  const renderer = await renderMeshInstance({
    loader: loaderServing(),
    node: meshInstanceNode({ mesh: 'SubResource("Quad")' }),
    internalResources: [subResource('ArrayMesh', 'Quad', { _surfaces: `[${surface}]` })],
  });
  return instanceAs<THREE.Mesh>(renderer.scene.findByType('Mesh')).geometry;
}

describe('MeshInstance3D with a 2D-vertex ArrayMesh', () => {
  it('draws the four vertices at their x and y, with z = 0', async () => {
    const positions = (await geometryOf(quad2DVerticesSurface())).getAttribute('position');

    expect(Array.from(positions.array)).toEqual([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0]);
  });
});

describe('MeshInstance3D with a vertex-coloured ArrayMesh', () => {
  it('carries the stored colours as a colour attribute', async () => {
    const color = (await geometryOf(colouredQuadSurface())).getAttribute('color');

    expect(Array.from(color.array).slice(0, 8)).toEqual([255, 0, 0, 255, 0, 255, 0, 127]);
  });
});
