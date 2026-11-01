/**
 * ConeTwistJoint3D draws its swing cone and twist spiral for every node, faint while unselected
 * (ADR-0056). The joint simulation is runtime only (ADR-0005), so the previewer's editor pose has no
 * drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { ConeTwistJoint3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'ConeTwistJoint3D',
  Component: ConeTwistJoint3D,
});
