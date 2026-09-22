import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGCylinder3D } from './index.r3f';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CSGCylinder3DProperties } from './types';
import { findMesh } from '../../testing/reactThreeTestInstance';

function makeNode(props: Partial<CSGCylinder3DProperties>, children: TscnNode[] = []): TscnNode {
  const properties: CSGCylinder3DProperties = {
    name: 'Cyl',
    radius: 0.25,
    height: 0.8,
    sides: 8,
    cone: false,
    smoothFaces: true,
    flipFaces: false,
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
  return findMesh(renderer.scene).geometry;
}

/**
 * Distinct RIM positions at a given height. Excludes the on-axis point, which is the
 * cap's centre vertex and sits at the same height as the ring it fans to.
 */
function ringAt(geometry: THREE.BufferGeometry, y: number): Set<string> {
  const p = geometry.getAttribute('position');
  const ring = new Set<string>();
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - y) > 1e-6) continue;
    const [x, z] = [p.getX(i), p.getZ(i)];
    if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) continue;
    ring.add(`${x.toFixed(5)},${z.toFixed(5)}`);
  }
  return ring;
}

describe('<CSGCylinder3D>', () => {
  // The geometry is Godot's brush construction, not three's CylinderGeometry, so there
  // is no `.parameters` to read; these assert the shape itself. Depth coverage of the
  // construction lives in cylinderGeometry.test.ts.
  it('builds a cylinder of the requested radius, height and side count', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.25, height: 0.8, sides: 8 }));
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.x).toBeCloseTo(0.25, 5);
    expect(box.min.y).toBeCloseTo(-0.4, 5);
    expect(box.max.y).toBeCloseTo(0.4, 5);
    // Both rings carry the full complement of distinct radial positions.
    expect(ringAt(geom, -0.4).size).toBe(8);
    expect(ringAt(geom, 0.4).size).toBe(8);
  });

  it('collapses the top ring to a single apex vertex when cone=true', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.5, height: 0.8, cone: true }));
    expect(ringAt(geom, -0.4).size).toBe(8);
    // Nothing off-axis remains at the top: the ring has collapsed to the apex.
    expect(ringAt(geom, 0.4).size).toBe(0);
  });

  it('applies the StandardMaterial3D albedo color from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_pole',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.4, 0.3, 0.25, 1)' },
    };
    const renderer = await render(
      makeNode({ materialPath: 'SubResource("StandardMaterial3D_pole")' }),
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
