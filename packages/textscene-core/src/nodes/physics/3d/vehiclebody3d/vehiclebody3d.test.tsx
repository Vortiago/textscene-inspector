/**
 * VehicleBody3D renders as a transform-only group (ADR-0005, ADR-0008). Its
 * registration makes the tree and the inspector stop calling it unsupported,
 * and applies `visible`, which GenericNodeFallback does not.
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
    // transformOnly.render-contract.test.tsx derives its subjects from this
    // flag, so dropping it would shrink that suite instead of failing it.
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

// The shared r3f/nodes/transformOnly.render-contract.test.tsx asserts the rest of
// the ADR-0008 contract for VehicleBody3D. It checks only the default-visible
// case, so `visible = false` stays here.
describe('<VehicleBody3D> render contract', () => {
  it('honours visible = false, hiding itself and its subtree', async () => {
    const renderer = await render(vehicleNode({ visible: false }));
    expect(renderer.scene.findByProps({ name: 'Vehicle' }).instance.visible).toBe(false);
  });
});
