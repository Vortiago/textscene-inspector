/**
 * SpringArm3D draws its length line while selected. It registers no drive: Godot places the
 * children only outside the editor (`spring_arm_3d.cpp:39`), and the previewer shows the editor pose.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SpringArm3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'SpringArm3D',
  Component: SpringArm3D,
});
