import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CSGSphere3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CSGSphere3DProperties } from './types';

function makeNode(props: Partial<CSGSphere3DProperties>, children: TscnNode[] = []): TscnNode {
  const properties: CSGSphere3DProperties = {
    name: 'Sphere',
    radius: 1.25,
    radialSegments: 48,
    rings: 24,
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
  it('renders a SphereGeometry sized from radius with segments/rings mapped', async () => {
    const renderer = await render(makeNode({ radius: 1.25, radialSegments: 48, rings: 24 }));
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.SphereGeometry & {
      parameters: { radius: number; widthSegments: number; heightSegments: number };
    };
    expect(geom.parameters.radius).toBe(1.25);
    expect(geom.parameters.widthSegments).toBe(48);
    expect(geom.parameters.heightSegments).toBe(24);
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
