/**
 * GPUParticlesCollisionSDF3D registration: the parser, which reads the shape for the gizmo. Property knowledge lives in
 * linterParser.ts. It is not rendered: index.r3f.ts registers a base component under
 * `renderIntent: 'pending'`, so the tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../../core/NodeRegistry';
import { parseSdfVolume } from '../../volume/parseSdfVolume';

const gPUParticlesCollisionSDF3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticlesCollisionSDF3D',
  parser: parseSdfVolume,
};

nodeRegistry.register(gPUParticlesCollisionSDF3DRegistration);
