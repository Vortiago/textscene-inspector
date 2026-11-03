/**
 * Every Shape3D the gizmo draws gets the lines of its Godot `get_debug_mesh_lines()`, not a three.js
 * mesh and not a 1x1x1 box. The expected vertices are the Godot 4.6.3 `get_debug_mesh()` readings
 * that `shapeDebugLines.test.ts` pins too.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionGizmo } from './CollisionGizmo';
import type { TscnInternalResource } from '../../../../parser/types';
import { linePositions } from '../../../../r3f/testing/GizmoScene';
import { settlePendingLoads } from '../../../../r3f/testing/settleLoads';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { findMesh } from '../../../3d/testing/reactThreeTestInstance';
import { godotDebugLinesFor, undirectedEdges } from '../../shared/godotDebugLines.testkit';

/** Mounts the gizmo, lets its lazy hull chunk land, and returns the renderer with the lines drawn. */
async function drawn(shape: TscnInternalResource) {
  const { loader } = createFakeResourceLoader();
  const gizmo = (
    <ResourceLoaderProvider loader={loader}>
      <CollisionGizmo shape={shape} color={new THREE.Color(0x00ff88)} />
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(gizmo);
  await settlePendingLoads(loader);
  await renderer.update(gizmo);
  return { positions: linePositions(renderer), meshCount: renderer.scene.findAllByType('Mesh').length };
}

describe.each(['BoxShape3D', 'SphereShape3D', 'CylinderShape3D', 'CapsuleShape3D', 'WorldBoundaryShape3D'])(
  '<CollisionGizmo> %s',
  (type) => {
    it.each(godotDebugLinesFor(type))(
      'draws every vertex Godot draws for $name',
      async ({ shape, lines }) => {
        const { positions, meshCount } = await drawn(shape);
        expect(positions).toHaveLength(lines.length);
        lines.forEach((value, index) => expect(positions[index]).toBeCloseTo(value, 4));
        expect(meshCount).toBe(0);
      }
    );
  }
);

describe.each(['ConcavePolygonShape3D', 'ConvexPolygonShape3D'])('<CollisionGizmo> %s', (type) => {
  it.each(godotDebugLinesFor(type))('draws every edge Godot draws for $name', async ({ shape, lines }) => {
    const { positions, meshCount } = await drawn(shape);
    expect(undirectedEdges(positions)).toEqual(undirectedEdges(lines));
    expect(meshCount).toBe(0);
  });
});

describe('<CollisionGizmo> unknown shape', () => {
  it('still falls back to a unit box for a genuinely unknown shape type', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CollisionGizmo
        shape={{ id: 'SeparationRayShape3D_1', type: 'SeparationRayShape3D', data: {} }}
        color={new THREE.Color(0x00ff88)}
      />
    );
    expect((findMesh(renderer.scene).geometry as THREE.BufferGeometry).type).toBe('BoxGeometry');
  });
});
