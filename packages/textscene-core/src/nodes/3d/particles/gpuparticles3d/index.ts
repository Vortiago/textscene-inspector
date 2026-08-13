/**
 * GPUParticles3D registration — parser.
 *
 * Reuses the Node3D parse; property knowledge lives in linterParser.ts.
 * The previewer does not simulate or draw particles, so index.r3f.ts registers
 * Node3D under `renderIntent: 'pending'` and the tree still reports a gap.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const gpuParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles3D',
  parser: parseNode3D,
};

nodeRegistry.register(gpuParticles3DRegistration);

export { gpuParticles3DRegistration };
