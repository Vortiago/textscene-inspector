/**
 * GPUParticlesCollisionSDF3D registration: parser.
 *
 * Reuses the Node3D parse; property knowledge lives in linterParser.ts.
 * Not rendered: index.r3f.ts registers Node3D under `renderIntent: 'pending'`,
 * so the tree still reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../../core/NodeRegistry';
import { parseNode3D } from '../../../../base/node3d/parser';

const gPUParticlesCollisionSDF3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticlesCollisionSDF3D',
  parser: parseNode3D,
};

nodeRegistry.register(gPUParticlesCollisionSDF3DRegistration);

export { gPUParticlesCollisionSDF3DRegistration };
