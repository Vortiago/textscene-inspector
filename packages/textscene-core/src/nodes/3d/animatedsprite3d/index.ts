/**
 * AnimatedSprite3D registration: the parser, which reads what places the quad. Property knowledge
 * lives in linterParser.ts. index.r3f.ts registers the base under `renderIntent: 'pending'`, so the
 * tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimatedSprite3D } from './parser';

const animatedSprite3DRegistration: NodeTypeRegistration = {
  typeName: 'AnimatedSprite3D',
  parser: parseAnimatedSprite3D,
};

nodeRegistry.register(animatedSprite3DRegistration);

export { animatedSprite3DRegistration };
