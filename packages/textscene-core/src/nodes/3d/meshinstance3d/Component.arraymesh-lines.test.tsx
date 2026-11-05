/**
 * An ArrayMesh with a LINES or LINE_STRIP surface draws as THREE.LineSegments (`Mesh.PRIMITIVE_LINES`),
 * and beside its triangle surfaces: Godot draws every surface.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

async function render(surfaces: string) {
  return renderMeshInstance({
    loader: loaderServing(),
    node: meshInstanceNode({ mesh: 'SubResource("Wire")' }),
    internalResources: [subResource('ArrayMesh', 'Wire', { _surfaces: surfaces })],
  });
}

describe('MeshInstance3D with an ArrayMesh of lines', () => {
  it('draws one THREE.LineSegments over the surface, and no triangle mesh', async () => {
    const renderer = await render(wallQuadSurfaces({ name: 'wire', primitive: 1 }));
    const lines = instanceAs<THREE.LineSegments>(renderer.scene.findByType('LineSegments'));

    expect(lines.geometry.getAttribute('position').count).toBe(4);
    expect(renderer.scene.findAllByType('Mesh')).toEqual([]);
  });

  it('draws a line strip as the segments between its neighbours', async () => {
    const renderer = await render(wallQuadSurfaces({ name: 'wire', primitive: 2 }));
    const lines = instanceAs<THREE.LineSegments>(renderer.scene.findByType('LineSegments'));

    expect(lines.geometry.getIndex()!.count % 2).toBe(0);
  });

  it('draws the lines of a mesh beside its triangles, each over its own surface', async () => {
    const renderer = await render(wallQuadSurfaces({ name: 'wall' }, { name: 'wire', primitive: 1 }));
    const mesh = instanceAs<THREE.Mesh>(renderer.scene.findByType('Mesh'));
    const lines = instanceAs<THREE.LineSegments>(renderer.scene.findByType('LineSegments'));

    expect(mesh.geometry.getIndex()!.count).toBe(6);
    expect(lines.geometry.getIndex()!.count).toBe(6);
  });
});
