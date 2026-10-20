/**
 * SpringArm3D places its children along its arm every physics frame. That drive is
 * a gap here (ADR-0045), so it registers `pending` on a Node3D component that
 * keeps its children in the right transform space and draws the selected length
 * line (ADR-0018). The only importer of ./Component.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SpringArm3D } from './Component';
nodeComponentRegistry.register({
  typeName: 'SpringArm3D',
  Component: SpringArm3D,
  renderIntent: 'pending',
});
