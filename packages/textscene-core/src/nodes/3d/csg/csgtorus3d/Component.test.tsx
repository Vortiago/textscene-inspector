import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { parseCSGTorus3D } from './parser';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGTorus3D } from './index.r3f';
import type { CSGTorus3DProperties } from './types';

function makeNode(overrides: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  const properties = parseCSGTorus3D(
    { type: 'node', attributes: { type: 'CSGTorus3D', name: 'Ring' } },
    overrides
  );
  return { name: properties.name || 'Ring', type: 'CSGTorus3D', children, properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGTorus3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('<CSGTorus3D>', () => {
  it('renders a ring whose Y extent is the tube radius, not the ring radius', async () => {
    // The witness from scenes/demos/3d/csg/csg.tscn:268, finely tessellated so the
    // extent is the true radius rather than an inscribed polygon's.
    const renderer = await render(
      makeNode({ inner_radius: '0.25', outer_radius: '0.4', sides: '64', ring_sides: '64' })
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.y).toBeCloseTo(0.075, 3);
    expect(geom.boundingBox!.max.x).toBeCloseTo(0.4, 3);
  });

  it('applies the StandardMaterial3D albedo color from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_ring',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.4, 0.3, 0.25, 1)' },
    };
    const renderer = await render(
      makeNode({ material: 'SubResource("StandardMaterial3D_ring")' }),
      [material]
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    // sRGB to linear at parse time means the channel is darker than the raw 0.4 but
    // still non-zero and reddish, which proves the scalars were applied rather than
    // the default grey.
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeLessThan(0.4);
    expect(mat.color.r).toBeGreaterThan(mat.color.b);
  });

  it('falls back to a default material when none is set', async () => {
    const renderer = await render(makeNode());
    expect((renderer.scene.findByType('Mesh').instance as THREE.Mesh).material).toBeTruthy();
  });

  it('positions the ring at the node transform origin', async () => {
    const renderer = await render(
      makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)' })
    );
    const group = renderer.scene.findByType('Group').instance as THREE.Group;
    expect(group.position.y).toBeCloseTo(0.9, 5);
  });

  it('renders children inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[]}>
        <CSGTorus3D node={makeNode()}>
          <mesh name="injected-child" />
        </CSGTorus3D>
      </SceneResourcesProvider>
    );
    const injected = renderer.scene.find(
      (n) => (n.instance as THREE.Object3D).name === 'injected-child'
    );
    expect(injected).toBeTruthy();
  });

  it('renders nothing but does not throw when the radii are equal', async () => {
    // Godot returns an empty brush rather than clamping (csg_shape.cpp:1930).
    const renderer = await render(makeNode({ inner_radius: '0.5', outer_radius: '0.5' }));
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    expect(geom.getAttribute('position').count).toBe(0);
  });

  it('exposes the parsed properties the builder reads', () => {
    const props = makeNode({ ring_sides: '5' }).properties as CSGTorus3DProperties;
    expect(props.ringSides).toBe(5);
    expect(props.smoothFaces).toBe(true);
  });
});
