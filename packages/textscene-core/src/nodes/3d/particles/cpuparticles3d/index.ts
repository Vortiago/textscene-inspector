/**
 * CPUParticles3D registration: parser. Its own parse reads what the simulation, the draw and the box
 * need, and property knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCPUParticles3D } from './parser';

const cPUParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'CPUParticles3D',
  parser: parseCPUParticles3D,
};

nodeRegistry.register(cPUParticles3DRegistration);
