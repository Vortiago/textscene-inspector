/** CPUParticles2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCPUParticles2D } from './parser';
import { formatCPUParticles2DProperties } from './propertyFormatter';

const cpuParticles2DRegistration: NodeTypeRegistration = {
  typeName: 'CPUParticles2D',
  parser: parseCPUParticles2D,
  propertyFormatter: formatCPUParticles2DProperties,
};

nodeRegistry.register(cpuParticles2DRegistration);

export { cpuParticles2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
