/**
 * AnimatedSprite3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. index.r3f.ts registers Node3D under `renderIntent: 'pending'`, so the
 * tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const animatedSprite3DRegistration: NodeTypeRegistration = {
  typeName: 'AnimatedSprite3D',
  parser: parseNode3D,
};

nodeRegistry.register(animatedSprite3DRegistration);

export { animatedSprite3DRegistration };
