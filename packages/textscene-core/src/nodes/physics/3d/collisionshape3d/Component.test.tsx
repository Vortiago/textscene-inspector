import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { CollisionShape3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../../r3f/contexts/ViewportModeContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CollisionShape3DProperties } from './types';

const boxShape: TscnInternalResource = {
  id: 'BoxShape3D_1',
  type: 'BoxShape3D',
  data: { size: 'Vector3(2, 4, 0.3)' },
};

const convexShape: TscnInternalResource = {
  id: 'ConvexPolygonShape3D_1',
  type: 'ConvexPolygonShape3D',
  data: {
    points:
      'PackedVector3Array(-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5)',
  },
};

const concaveShape: TscnInternalResource = {
  id: 'ConcavePolygonShape3D_1',
  type: 'ConcavePolygonShape3D',
  data: { data: 'PackedVector3Array(-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5)' },
};

function makeNode(properties: Partial<CollisionShape3DProperties> = {}): TscnNode {
  const props: CollisionShape3DProperties = {
    name: 'Col',
    shape: 'SubResource("BoxShape3D_1")',
    ...properties,
  };
  return { name: 'Col', type: 'CollisionShape3D', children: [], properties: props };
}

async function render(
  showCollisions: boolean,
  properties: Partial<CollisionShape3DProperties> = {},
  internalResources: TscnInternalResource[] = [boxShape]
) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowCollisions={showCollisions}>
      <SceneResourcesProvider internalResources={internalResources}>
        <CollisionShape3D node={makeNode(properties)} />
      </SceneResourcesProvider>
    </ViewportModeProvider>
  );
}

describe('<CollisionShape3D> gizmo', () => {
  it('renders NO geometry when showCollisions is off (default)', async () => {
    const renderer = await render(false);
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(0);
  });

  it('renders a wireframe box gizmo when showCollisions is on', async () => {
    const renderer = await render(true);
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.BoxGeometry & {
      parameters: { width: number; height: number; depth: number };
    };
    expect(geom.parameters.width).toBe(2);
    expect(geom.parameters.height).toBe(4);
    expect(geom.parameters.depth).toBe(0.3);
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });

  it('renders a convex-hull wireframe for ConvexPolygonShape3D (lazy ConvexGeometry)', async () => {
    const tree = (
      <ViewportModeProvider initialShowCollisions>
        <SceneResourcesProvider internalResources={[convexShape]}>
          <CollisionShape3D
            node={makeNode({ shape: 'SubResource("ConvexPolygonShape3D_1")' })}
          />
        </SceneResourcesProvider>
      </ViewportModeProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);

    // ConvexHullWire lazy-`import()`s three's ConvexGeometry inside a
    // useEffect; wait (inside `act`) for the import + setState to settle,
    // then re-flush the tree so the test renderer's fiber snapshot picks up
    // the commit — same pattern as the missing-texture async resource chain
    // (Component.missing-texture.test.tsx).
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 100));
    });
    await renderer.update(tree);

    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.geometry.attributes.position.count).toBeGreaterThan(0);
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });

  it('renders a triangle-soup wireframe for ConcavePolygonShape3D', async () => {
    const renderer = await render(
      true,
      { shape: 'SubResource("ConcavePolygonShape3D_1")' },
      [concaveShape]
    );
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    expect(mesh.geometry.attributes.position.count).toBe(3);
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });

  it('renders no gizmo and does not crash when the shape SubResource is missing', async () => {
    const renderer = await render(
      true,
      { shape: 'SubResource("BoxShape3D_ghost")' },
      [boxShape]
    );
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(0);
  });

  it('renders no gizmo when shape is undefined', async () => {
    const renderer = await render(true, { shape: undefined }, [boxShape]);
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(0);
  });

  it('still renders the gizmo when disabled=true and showCollisions is on', async () => {
    const renderer = await render(true, { disabled: true });
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(1);
  });

  it('applies the node transform to the gizmo group', async () => {
    const renderer = await render(true, {
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 3, y: -1.5, z: 0.25 },
      },
    });
    const group = renderer.scene.findByProps({ name: 'Col' }).instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(3, 5);
    expect(group.position.y).toBeCloseTo(-1.5, 5);
    expect(group.position.z).toBeCloseTo(0.25, 5);
  });
});
