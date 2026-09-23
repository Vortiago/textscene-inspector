/**
 * Registers the GPUParticles2D parser. It reuses the Node2D parse, and its
 * property knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode2D } from '../../../base/node2d/parser';

const gPUParticles2DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles2D',
  parser: parseNode2D,
};

nodeRegistry.register(gPUParticles2DRegistration);

export { gPUParticles2DRegistration };
