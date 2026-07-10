import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CSGCylinder3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CSGCylinder3DProperties } from './types';

function makeNode(props: Partial<CSGCylinder3DProperties>, children: TscnNode[] = []): TscnNode {
  const properties: CSGCylinder3DProperties = {
    name: 'Cyl',
    radius: 0.25,
    height: 0.8,
    sides: 8,
    cone: false,
    ...props,
  };
  return { name: properties.name, type: 'CSGCylinder3D', children, properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGCylinder3D node={node} />
    </SceneResourcesProvider>
  );
}

async function geometryOf(node: TscnNode) {
  const renderer = await render(node);
  return renderer.scene.findByType('Mesh').instance.geometry as THREE.CylinderGeometry & {
    parameters: { radiusTop: number; radiusBottom: number; height: number; radialSegments: number };
  };
}

describe('<CSGCylinder3D>', () => {
  it('renders a CylinderGeometry with equal top/bottom radius and the right height/sides', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.25, height: 0.8, sides: 8 }));
    expect(geom.parameters.radiusTop).toBe(0.25);
    expect(geom.parameters.radiusBottom).toBe(0.25);
    expect(geom.parameters.height).toBe(0.8);
    expect(geom.parameters.radialSegments).toBe(8);
  });

  it('collapses the top radius to 0 when cone=true', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.5, cone: true }));
    expect(geom.parameters.radiusTop).toBe(0);
    expect(geom.parameters.radiusBottom).toBe(0.5);
  });

  it('applies the StandardMaterial3D albedo color from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_pole',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.4, 0.3, 0.25, 1)' },
    };
    const renderer = await render(
      makeNode({ material: 'SubResource("StandardMaterial3D_pole")' }),
      [material]
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    // sRGB→linear conversion at parse time means the channel is darker than
    // the raw 0.4 but still non-zero and below the input — proves the
    // material scalars were applied (not the default 0xcccccc grey).
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeLessThan(0.4);
    expect(mat.color.r).toBeGreaterThan(mat.color.b); // reddish-brown, r > b
  });

  it('falls back to a default material when no material is set', async () => {
    const renderer = await render(makeNode({}));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.material).toBeTruthy();
  });

  it('positions the cylinder at the node transform origin', async () => {
    const renderer = await render(
      makeNode({
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 1.4, z: 0 },
        },
      })
    );
    // The group wrapping the mesh carries the transform.
    const group = renderer.scene.findByType('Group').instance as THREE.Group;
    expect(group.position.y).toBeCloseTo(1.4, 5);
  });

  it('renders child nodes inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[]}>
        <CSGCylinder3D node={makeNode({ name: 'Parent' })}>
          <mesh name="injected-child" />
        </CSGCylinder3D>
      </SceneResourcesProvider>
    );
    const injected = renderer.scene.find(
      (n) => (n.instance as THREE.Object3D).name === 'injected-child'
    );
    expect(injected).toBeTruthy();
  });
});
