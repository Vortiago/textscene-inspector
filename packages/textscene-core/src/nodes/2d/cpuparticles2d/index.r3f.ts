import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { CPUParticles2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'CPUParticles2D',
  Component: CPUParticles2D,
  canvasItem: true,
});

export { CPUParticles2D };
