/**
 * PinJoint3D draws its pin cross for every node, faint while unselected (ADR-0056). The joint
 * simulation is runtime only (ADR-0005), so the previewer's editor pose has no drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { PinJoint3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'PinJoint3D',
  Component: PinJoint3D,
});
