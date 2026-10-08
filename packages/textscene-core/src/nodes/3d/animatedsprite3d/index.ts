/**
 * AnimatedSprite3D registration: the parser. It reuses the GeometryInstance3D parse, and property
 * knowledge lives in linterParser.ts. index.r3f.ts registers the base under `renderIntent: 'pending'`, so the
 * tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';

const animatedSprite3DRegistration: NodeTypeRegistration = {
  typeName: 'AnimatedSprite3D',
  parser: parseGeometryInstance3D,
};

nodeRegistry.register(animatedSprite3DRegistration);

export { animatedSprite3DRegistration };
