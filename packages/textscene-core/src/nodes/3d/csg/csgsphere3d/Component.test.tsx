import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGSphere3D } from './index.r3f';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CSGSphere3DProperties } from './types';

function makeNode(props: Partial<CSGSphere3DProperties>, children: TscnNode[] = []): TscnNode {
  const properties: CSGSphere3DProperties = {
    name: 'Sphere',
    radius: 1.25,
    radialSegments: 48,
    rings: 24,
    smoothFaces: true,
    flipFaces: false,
    ...props,
  };
  return { name: properties.name, type: 'CSGSphere3D', children, properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGSphere3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('<CSGSphere3D>', () => {
  // The geometry is Godot's brush construction, not three's SphereGeometry, so there is
  // no `.parameters` to read; this asserts the shape itself. Depth coverage of the
  // construction lives in sphereGeometry.test.ts.
  it('builds a sphere of the requested radius and tessellation', async () => {
    const renderer = await render(makeNode({ radius: 1.25, radialSegments: 48, rings: 24 }));
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingSphere();
    expect(geom.boundingSphere!.radius).toBeCloseTo(1.25, 5);
    // csg_shape.cpp:1329 — two triangles per segment per ring, one fewer at each pole.
    expect(geom.getAttribute('position').count / 3).toBe(24 * 48 * 2 - 48 * 2);
  });

  it('applies the StandardMaterial3D albedo color from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_sphere',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.4, 0.3, 0.25, 1)' },
    };
    const renderer = await render(
      makeNode({ material: 'SubResource("StandardMaterial3D_sphere")' }),
      [material]
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeLessThan(0.4);
    expect(mat.color.r).toBeGreaterThan(mat.color.b); // reddish-brown, r > b
  });

  it('falls back to a default material when no material is set', async () => {
    const renderer = await render(makeNode({}));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.material).toBeTruthy();
  });

  it('positions the sphere at the node transform origin', async () => {
    const renderer = await render(
      makeNode({
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: -1, y: 1, z: 1 },
        },
      })
    );
    const group = renderer.scene.findByType('Group').instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(-1, 5);
    expect(group.position.y).toBeCloseTo(1, 5);
    expect(group.position.z).toBeCloseTo(1, 5);
  });

  it('renders child nodes inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[]}>
        <CSGSphere3D node={makeNode({ name: 'Parent' })}>
          <mesh name="injected-child" />
        </CSGSphere3D>
      </SceneResourcesProvider>
    );
    const injected = renderer.scene.find(
      (n) => (n.instance as THREE.Object3D).name === 'injected-child'
    );
    expect(injected).toBeTruthy();
  });
});
