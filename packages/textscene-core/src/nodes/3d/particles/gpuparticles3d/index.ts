/**
 * GPUParticles3D registration: parser.
 *
 * Reuses the shared particle parse, and property knowledge lives in linterParser.ts.
 * The previewer does not simulate or draw particles, so index.r3f.ts registers
 * the GeometryInstance3D base under `renderIntent: 'pending'` and the tree still reports a gap.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseParticles3D } from '../parser';

const gpuParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles3D',
  parser: parseParticles3D,
};

nodeRegistry.register(gpuParticles3DRegistration);

export { gpuParticles3DRegistration };
