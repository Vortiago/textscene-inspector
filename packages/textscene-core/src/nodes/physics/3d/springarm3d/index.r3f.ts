/**
 * SpringArm3D draws nothing of its own (ADR-0008): the Node3D component keeps
 * its children in the right transform space.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
nodeComponentRegistry.register({
  typeName: 'SpringArm3D',
  Component: Node3D,
  renderIntent: 'transform-only',
});
