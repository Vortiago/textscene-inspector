/**
 * GPUParticles2D registration — parser.
 *
 * Reuses the Node2D parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode2D } from '../../../base/node2d/parser';

const gPUParticles2DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles2D',
  parser: parseNode2D,
};

nodeRegistry.register(gPUParticles2DRegistration);

export { gPUParticles2DRegistration };
