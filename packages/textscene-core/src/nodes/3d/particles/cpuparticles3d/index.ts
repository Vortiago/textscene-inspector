/**
 * CPUParticles3D registration: parser.
 *
 * Its own parse reads what its box needs, and property knowledge lives in linterParser.ts.
 * Not rendered: index.r3f.ts registers the base under `renderIntent: 'pending'`,
 * so the tree still reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCPUParticles3D } from './parser';

const cPUParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'CPUParticles3D',
  parser: parseCPUParticles3D,
};

nodeRegistry.register(cPUParticles3DRegistration);

export { cPUParticles3DRegistration };
