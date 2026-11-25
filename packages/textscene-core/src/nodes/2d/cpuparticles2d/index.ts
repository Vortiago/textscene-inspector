/** CPUParticles2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCPUParticles2D } from './parser';

const cpuParticles2DRegistration: NodeTypeRegistration = {
  typeName: 'CPUParticles2D',
  parser: parseCPUParticles2D,
};

nodeRegistry.register(cpuParticles2DRegistration);

export * from './parser';
export * from './types';
