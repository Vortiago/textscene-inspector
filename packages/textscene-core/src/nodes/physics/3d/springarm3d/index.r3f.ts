/**
 * SpringArm3D places its children along its arm every physics frame. That drive is
 * a gap here (ADR-0045), so it registers `pending` on the Node3D component, which
 * keeps its children in the right transform space.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
nodeComponentRegistry.register({
  typeName: 'SpringArm3D',
  Component: Node3D,
  renderIntent: 'pending',
});
