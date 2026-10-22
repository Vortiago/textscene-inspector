/**
 * An ArrayMesh with a POINTS surface draws as THREE.Points, as a PointMesh does
 * (`Mesh.PRIMITIVE_POINTS`), and beside its triangle surfaces: Godot draws every surface.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

const SIZED_MATERIAL = subResource('StandardMaterial3D', 'Sized', {
  use_point_size: 'true',
  point_size: '9',
});

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

describe('MeshInstance3D with an ArrayMesh of triangle and points surfaces', () => {
  const MIXED_SURFACES = wallQuadSurfaces({ name: 'wall' }, { name: 'dots', primitive: 0 });

  async function renderMixed(overrides = {}) {
    return renderMeshInstance({
      loader: loaderServing(),
      node: meshInstanceNode({ mesh: 'SubResource("Mixed")' }, overrides),
      internalResources: [subResource('ArrayMesh', 'Mixed', { _surfaces: MIXED_SURFACES }), SIZED_MATERIAL],
    });
  }

  it('draws a triangle mesh and a THREE.Points, each over its own surface', async () => {
    const renderer = await renderMixed();
    const mesh = instanceAs<THREE.Mesh>(renderer.scene.findByType('Mesh'));
    const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));

    expect(mesh.geometry.getIndex()!.count).toBe(6);
    expect(Array.from(points.geometry.getIndex()!.array)).toEqual([2, 0, 3, 2, 1, 0]);
  });

  it('sizes the points from the override of the points surface by its own index', async () => {
    const renderer = await renderMixed({ surfaceMaterialOverrides: new Map([[1, 'SubResource("Sized")']]) });
    const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));

    expect((points.material as THREE.Material).userData.godotPointSize).toBe(9);
  });

  it('casts a shadow from the points as the triangles do', async () => {
    const renderer = await renderMixed();

    expect(instanceAs<THREE.Points>(renderer.scene.findByType('Points')).castShadow).toBe(true);
  });
});
