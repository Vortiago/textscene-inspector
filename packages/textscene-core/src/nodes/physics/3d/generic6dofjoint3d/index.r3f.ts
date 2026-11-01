/**
 * Generic6DOFJoint3D draws its travel and the circles toward each body for every node, faint while
 * unselected (ADR-0056). The joint simulation is runtime only (ADR-0005), so the previewer's editor pose
 * has no drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Generic6DOFJoint3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'Generic6DOFJoint3D',
  Component: Generic6DOFJoint3D,
});
