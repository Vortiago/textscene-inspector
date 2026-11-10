/**
 * DampedSpringJoint2D draws its editor marker for every node (ADR-0056). The joint simulation is runtime only
 * (ADR-0005), so the marker has no simulation to follow.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { DampedSpringJoint2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'DampedSpringJoint2D',
  Component: DampedSpringJoint2D,
  canvasItem: true,
});
