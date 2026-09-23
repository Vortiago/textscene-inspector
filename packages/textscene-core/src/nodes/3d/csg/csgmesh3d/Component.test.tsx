import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { parseCSGMesh3D } from './parser';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGMesh3D } from './index.r3f';
import { findMesh } from '../../testing/reactThreeTestInstance';

const BOX_MESH: TscnInternalResource = {
  id: 'BoxMesh_csg',
  type: 'BoxMesh',
  data: { size: 'Vector3(1.5, 1, 1.5)' },
};

const CAPSULE_MESH: TscnInternalResource = {
  id: 'CapsuleMesh_csg',
  type: 'CapsuleMesh',
  data: { radius: '0.4', height: '1.6' },
};

function makeNode(overrides: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  const properties = parseCSGMesh3D(
    { type: 'node', attributes: { type: 'CSGMesh3D', name: 'Mesh' } },
    overrides
  );
  return { name: 'Mesh', type: 'CSGMesh3D', children, properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGMesh3D node={node} />
    </SceneResourcesProvider>
  );
}

function geometryOf(renderer: Awaited<ReturnType<typeof render>>): THREE.BufferGeometry {
  return findMesh(renderer.scene).geometry;
}

describe('<CSGMesh3D>', () => {
  it('builds geometry from a BoxMesh sub-resource', async () => {
    const geom = geometryOf(await render(makeNode({ mesh: 'SubResource("BoxMesh_csg")' }), [BOX_MESH]));
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.x).toBeCloseTo(0.75, 5);
    expect(geom.boundingBox!.max.y).toBeCloseTo(0.5, 5);
  });

  it('builds geometry from a CapsuleMesh sub-resource', async () => {
    const geom = geometryOf(
      await render(makeNode({ mesh: 'SubResource("CapsuleMesh_csg")' }), [CAPSULE_MESH])
    );
    geom.computeBoundingBox();
    // Godot's `height` is the total, including both caps.
    expect(geom.boundingBox!.max.y).toBeCloseTo(0.8, 3);
    expect(geom.boundingBox!.max.x).toBeCloseTo(0.4, 3);
  });

  it('draws nothing at all, not a placeholder, when `mesh` is absent', async () => {
    // Godot builds an empty brush for a CSGMesh3D with no mesh (csg_shape.cpp:1126).
    // No mesh is a closer match to that than an empty one, and neither is a magenta box.
    const renderer = await render(makeNode());
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    // The transform group survives, so children still land in the right place.
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('does not throw when the mesh reference cannot be resolved', async () => {
    const renderer = await render(makeNode({ mesh: 'SubResource("Missing_1")' }));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('applies the node’s own material, proving it goes through CsgPrimitive', async () => {
    // Not through MeshInstance3D's pipeline: Godot's CSGMesh3D has one material that
    // replaces the mesh's own, with no per-surface override concept.
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_csgmesh',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.3, 0.6, 0.8, 1)' },
    };
    const renderer = await render(
      makeNode({ mesh: 'SubResource("BoxMesh_csg")', material: 'SubResource("StandardMaterial3D_csgmesh")' }),
      [BOX_MESH, material]
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    // sRGB to linear at parse time, so blue stays dominant but darker than 0.8.
    expect(mat.color.b).toBeGreaterThan(mat.color.r);
    expect(mat.color.b).toBeLessThan(0.8);
  });

  it('positions the mesh at the node transform origin', async () => {
    const renderer = await render(
      makeNode({
        mesh: 'SubResource("BoxMesh_csg")',
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1.2, 0, 0)',
      }),
      [BOX_MESH]
    );
    expect((renderer.scene.findByType('Group').instance as THREE.Group).position.x).toBeCloseTo(-1.2, 5);
  });

  it('renders children inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[BOX_MESH]}>
        <CSGMesh3D node={makeNode({ mesh: 'SubResource("BoxMesh_csg")' })}>
          <mesh name="injected-child" />
        </CSGMesh3D>
      </SceneResourcesProvider>
    );
    expect(
      renderer.scene.find((n) => (n.instance as THREE.Object3D).name === 'injected-child')
    ).toBeTruthy();
  });
});
