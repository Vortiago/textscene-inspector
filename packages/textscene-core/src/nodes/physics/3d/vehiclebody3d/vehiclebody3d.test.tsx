/**
 * VehicleBody3D is a RigidBody3D subclass and renders the same way: a
 * transform-only group (ADR-0005, ADR-0008). What registering it buys is what
 * this file pins — the tree/inspector stop calling it unsupported, and `visible`
 * is honoured, which GenericNodeFallback never applied.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import '../../../../r3f/nodes/index'; // side-effect: component registrations
import '../../../../parser/TscnParser'; // side-effect: parser registrations
import { isRenderableNodeType } from '../../../../r3f/nodeSupport';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import type { TscnNode } from '../../../../parser/types';

describe('VehicleBody3D registration', () => {
  it('is reported as supported, so no "Not Implemented" badge', () => {
    expect(isRenderableNodeType('VehicleBody3D')).toBe(true);
  });

  it('reuses the Node3D transform parse', () => {
    const registration = nodeRegistry.getRegistration('VehicleBody3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });
});

/** A VehicleBody3D with one Node3D child, rendered through the real dispatcher. */
function vehicleNode(properties: Record<string, unknown>): TscnNode {
  return {
    name: 'Vehicle',
    type: 'VehicleBody3D',
    children: [{ name: 'Kid', type: 'Node3D', children: [], properties: { name: 'Kid' } }],
    properties: { name: 'Vehicle', ...properties },
  } as TscnNode;
}

async function render(node: TscnNode) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <NodeDispatcher nodes={[node]} />
    </SelectionProvider>
  );
}

describe('<VehicleBody3D> render contract', () => {
  it('honours visible = false, hiding itself and its subtree', async () => {
    const renderer = await render(vehicleNode({ visible: false }));
    expect(renderer.scene.findByProps({ name: 'Vehicle' }).instance.visible).toBe(false);
  });

  it('stays visible when visible is not authored', async () => {
    const renderer = await render(vehicleNode({}));
    expect(renderer.scene.findByProps({ name: 'Vehicle' }).instance.visible).toBe(true);
  });

  it('is a real registration, not the generic placeholder fallback', async () => {
    const renderer = await render(vehicleNode({}));
    const group = renderer.scene.findByProps({ name: 'Vehicle' });
    expect(group.instance.userData.isPlaceholder).toBeUndefined();
  });
});
