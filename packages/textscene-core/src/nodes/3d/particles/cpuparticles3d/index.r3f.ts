/** CPUParticles3D draws its frozen particle pose, and its editor gizmos. */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CPUParticles3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'CPUParticles3D',
  Component: CPUParticles3D,
  renderIntent: 'draws',
  editorIcon: { icon: 'GizmoCPUParticles3D' },
});
