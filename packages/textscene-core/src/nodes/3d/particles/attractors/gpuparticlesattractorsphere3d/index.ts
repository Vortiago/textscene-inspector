/**
 * GPUParticlesAttractorSphere3D registration: the parser, which reads the shape for the gizmo. Property knowledge lives in
 * linterParser.ts. It is not rendered: index.r3f.ts registers a base component under
 * `renderIntent: 'pending'`, so the tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../../core/NodeRegistry';
import { parseSphereVolume } from '../../volume/parseSphereVolume';

const gPUParticlesAttractorSphere3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticlesAttractorSphere3D',
  parser: parseSphereVolume,
};

nodeRegistry.register(gPUParticlesAttractorSphere3DRegistration);
