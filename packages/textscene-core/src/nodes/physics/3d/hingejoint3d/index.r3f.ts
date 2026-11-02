/**
 * HingeJoint3D draws its axis and a circle toward each body for every node, faint while unselected
 * (ADR-0056). The joint simulation is runtime only (ADR-0005), so the previewer's editor pose has no
 * drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { HingeJoint3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'HingeJoint3D',
  Component: HingeJoint3D,
});
