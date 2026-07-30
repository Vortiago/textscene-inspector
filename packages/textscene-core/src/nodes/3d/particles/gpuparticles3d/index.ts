/**
 * GPUParticles3D registration — parser.
 *
 * Reuses the Node3D parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 * The previewer does not simulate or draw particles.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const gpuParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles3D',
  parser: parseNode3D,
};

nodeRegistry.register(gpuParticles3DRegistration);

export { gpuParticles3DRegistration };
