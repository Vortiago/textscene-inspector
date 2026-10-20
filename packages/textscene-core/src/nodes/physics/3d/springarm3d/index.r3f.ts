/**
 * SpringArm3D draws its length line while selected. Godot places its children only outside the
 * editor (`spring_arm_3d.cpp:39`), so the previewer's editor pose has no drive to register.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SpringArm3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'SpringArm3D',
  Component: SpringArm3D,
});
