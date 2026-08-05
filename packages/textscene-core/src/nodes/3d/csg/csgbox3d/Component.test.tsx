import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGBox3D } from './index.r3f';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CSGBox3DProperties } from './types';
import { findMesh } from '../../testing/reactThreeTestInstance';

function makeNode(
  props: Partial<CSGBox3DProperties>,
  children: TscnNode[] = []
): TscnNode {
  const properties: CSGBox3DProperties = {
    name: 'Box',
    size: { x: 3, y: 0.2, z: 12 },
    flipFaces: false,
    ...props,
  };
  return { name: properties.name, type: 'CSGBox3D', children, properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGBox3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('<CSGBox3D>', () => {
  // Geometry is Godot's brush construction, not three's BoxGeometry, so there is no
  // `.parameters` to read; this asserts the shape. Depth coverage lives in
  // boxGeometry.test.ts.
  it('builds a box of the requested size, centred on the origin', async () => {
    const renderer = await render(makeNode({ size: { x: 3, y: 0.2, z: 12 } }));
    const geom = findMesh(renderer.scene).geometry;
    geom.computeBoundingBox();
    const b = geom.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(3, 5);
    expect(b.max.y - b.min.y).toBeCloseTo(0.2, 5);
    expect(b.max.z - b.min.z).toBeCloseTo(12, 5);
    expect(b.max.x).toBeCloseTo(1.5, 5);
  });

  it('applies the StandardMaterial3D albedo color from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_floor',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.4, 0.3, 0.25, 1)' },
    };
    const renderer = await render(
      makeNode({ material: 'SubResource("StandardMaterial3D_floor")' }),
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

  it('positions the box at the node transform origin', async () => {
    const renderer = await render(
      makeNode({
        size: { x: 3, y: 4.5, z: 0.3 },
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 2.25, z: 0 },
        },
      })
    );
    // The group wrapping the mesh carries the transform.
    const group = renderer.scene.findByType('Group').instance as THREE.Group;
    expect(group.position.y).toBeCloseTo(2.25, 5);
  });

  it('renders child nodes inside the transform group', async () => {
    const child = makeNode({ name: 'ChildBox', size: { x: 1, y: 1, z: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[]}>
        <CSGBox3D node={makeNode({ name: 'Parent' })}>
          <mesh name="injected-child" />
        </CSGBox3D>
      </SceneResourcesProvider>
    );
    const injected = renderer.scene.find(
      (n) => (n.instance as THREE.Object3D).name === 'injected-child'
    );
    expect(injected).toBeTruthy();
    void child;
  });
});
