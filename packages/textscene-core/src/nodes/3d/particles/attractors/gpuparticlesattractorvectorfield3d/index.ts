/**
 * GPUParticlesAttractorVectorField3D registration: the parser, which reads the shape for the gizmo. Property knowledge lives in
 * linterParser.ts. It is not rendered: index.r3f.ts registers a base component under
 * `renderIntent: 'pending'`, so the tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../../core/NodeRegistry';
import { parseBoxVolume } from '../../volume/parseBoxVolume';

const gPUParticlesAttractorVectorField3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticlesAttractorVectorField3D',
  parser: parseBoxVolume,
};

nodeRegistry.register(gPUParticlesAttractorVectorField3DRegistration);
