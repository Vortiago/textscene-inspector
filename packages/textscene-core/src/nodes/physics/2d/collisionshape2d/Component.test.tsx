import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionShape2D } from './Component';
import { parseCollisionShape2D } from './parser';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../../r3f/contexts/ViewportModeContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';

const rectShape: TscnInternalResource = {
  id: 'RectangleShape2D_1',
  type: 'RectangleShape2D',
  data: { size: 'Vector2(40, 60)' },
};
const circleShape: TscnInternalResource = {
  id: 'CircleShape2D_1',
  type: 'CircleShape2D',
  data: { radius: '15' },
};
const capsuleShape: TscnInternalResource = {
  id: 'CapsuleShape2D_1',
  type: 'CapsuleShape2D',
  data: { radius: '10', height: '30' },
};

const heading = { type: 'node' as const, attributes: { type: 'CollisionShape2D', name: 'Col' } };

function makeNode(shapeRef: string | undefined): TscnNode {
  const properties = parseCollisionShape2D(heading, shapeRef ? { shape: shapeRef } : {});
  return { name: 'Col', type: 'CollisionShape2D', children: [], properties };
}

async function render(showCollisions: boolean, resources: TscnInternalResource[], shapeRef: string | undefined) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowCollisions={showCollisions}>
      <SceneResourcesProvider internalResources={resources}>
        <CollisionShape2D node={makeNode(shapeRef)} />
      </SceneResourcesProvider>
    </ViewportModeProvider>
  );
}

describe('<CollisionShape2D> gizmo', () => {
  it('renders NO geometry when showCollisions is off (default)', async () => {
    const renderer = await render(false, [rectShape], 'SubResource("RectangleShape2D_1")');
    const lines = renderer.scene.findAll((n) => n.type === 'LineSegments');
    expect(lines).toHaveLength(0);
  });

  it('renders a rectangle outline gizmo when showCollisions is on', async () => {
    const renderer = await render(true, [rectShape], 'SubResource("RectangleShape2D_1")');
    const lines = renderer.scene.findAll((n) => n.type === 'LineSegments');
    expect(lines).toHaveLength(1);
  });

  it('renders a circle outline gizmo', async () => {
    const renderer = await render(true, [circleShape], 'SubResource("CircleShape2D_1")');
    const lines = renderer.scene.findAll((n) => n.type === 'LineSegments');
    expect(lines).toHaveLength(1);
  });

  it('renders a capsule outline gizmo', async () => {
    const renderer = await render(true, [capsuleShape], 'SubResource("CapsuleShape2D_1")');
    const lines = renderer.scene.findAll((n) => n.type === 'LineSegments');
    expect(lines).toHaveLength(1);
  });

  it('renders nothing when the shape reference is absent', async () => {
    const renderer = await render(true, [], undefined);
    const lines = renderer.scene.findAll((n) => n.type === 'LineSegments');
    expect(lines).toHaveLength(0);
  });

  it('renders children regardless of the gizmo', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowCollisions={false}>
        <SceneResourcesProvider internalResources={[]}>
          <CollisionShape2D node={makeNode(undefined)}>
            <mesh name="child" />
          </CollisionShape2D>
        </SceneResourcesProvider>
      </ViewportModeProvider>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
