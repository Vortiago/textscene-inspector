import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionShape3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { linePositions } from '../../../../r3f/testing/GizmoScene';
import { ViewportModeProvider } from '../../../../r3f/contexts/ViewportModeContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CollisionShape3DProperties } from './types';
import { settlePendingLoads } from '../../../../r3f/testing/settleLoads';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';

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
  return { rawProperties: {}, name: 'Col', type: 'CollisionShape3D', children: [], properties: props };
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

  it('renders the box outline as line segments when showCollisions is on', async () => {
    const renderer = await render(true);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
    expect(linePositions(renderer)).toHaveLength(24 * 3);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('renders the 12 hull edges of a cube for ConvexPolygonShape3D (lazy ConvexGeometry)', async () => {
    const { loader } = createFakeResourceLoader();
    const tree = (
      <ResourceLoaderProvider loader={loader}>
        <ViewportModeProvider initialShowCollisions>
          <SceneResourcesProvider internalResources={[convexShape]}>
            <CollisionShape3D node={makeNode({ shape: 'SubResource("ConvexPolygonShape3D_1")' })} />
          </SceneResourcesProvider>
        </ViewportModeProvider>
      </ResourceLoaderProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);

    // Lets the hull's lazy chunk land, then re-flushes so the test renderer's fiber snapshot picks
    // up the commit.
    await settlePendingLoads(loader);
    await renderer.update(tree);

    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
    expect(linePositions(renderer)).toHaveLength(12 * 2 * 3);
  });

  it('renders the 3 edges of a triangle for ConcavePolygonShape3D', async () => {
    const renderer = await render(true, { shape: 'SubResource("ConcavePolygonShape3D_1")' }, [concaveShape]);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
    expect(linePositions(renderer)).toHaveLength(3 * 2 * 3);
  });

  it('renders no gizmo and does not crash when the shape SubResource is missing', async () => {
    const renderer = await render(true, { shape: 'SubResource("BoxShape3D_ghost")' }, [boxShape]);
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
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
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
