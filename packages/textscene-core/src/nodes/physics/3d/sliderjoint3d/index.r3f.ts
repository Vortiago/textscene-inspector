/**
 * SliderJoint3D draws its travel and a circle toward each body for every node, faint while unselected
 * (ADR-0056). The joint simulation is runtime only (ADR-0005), so the previewer's editor pose has no
 * drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SliderJoint3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'SliderJoint3D',
  Component: SliderJoint3D,
});
