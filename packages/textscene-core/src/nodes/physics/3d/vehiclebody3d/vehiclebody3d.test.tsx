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
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../../base/node3d/parser';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import type { TscnNode } from '../../../../parser/types';

describe('VehicleBody3D registration', () => {
  it('is reported as transform-only, so no "Not Implemented" badge', () => {
    expect(rendersOwnVisual('VehicleBody3D')).toBe('transform-only');
  });

  it('reuses the Node3D transform parse', () => {
    const registration = nodeRegistry.getRegistration('VehicleBody3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('declares drawing nothing of its own, which is what joins it to the shared contract', () => {
    // transformOnly.render-contract.test.tsx DERIVES its subjects from this
    // flag, so dropping it would silently shrink that suite instead of failing
    // it. Pinned here, where the registration lives.
    expect(nodeComponentRegistry.isTransformOnly('VehicleBody3D')).toBe(true);
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

// The rest of the ADR-0008 rendered contract — bare Group, no placeholder
// userData, visible by default, zero own meshes, children inheriting the
// transform — is asserted for VehicleBody3D by the shared
// r3f/nodes/transformOnly.render-contract.test.tsx, which this slice joins.
// Only `visible = false` is left here, because that contract checks the
// default-visible case and this is the behaviour registering the type restored.
describe('<VehicleBody3D> render contract', () => {
  it('honours visible = false, hiding itself and its subtree', async () => {
    const renderer = await render(vehicleNode({ visible: false }));
    expect(renderer.scene.findByProps({ name: 'Vehicle' }).instance.visible).toBe(false);
  });
});
