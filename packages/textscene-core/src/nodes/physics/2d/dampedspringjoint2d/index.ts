/**
 * DampedSpringJoint2D registration: the parser.
 *
 * It reuses the Node2D parse, and property knowledge lives in linterParser.ts. It
 * draws nothing by design (ADR-0008), so index.r3f.ts registers Node2D and its children
 * still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode2D } from '../../../base/node2d/parser';

const dampedSpringJoint2DRegistration: NodeTypeRegistration = {
  typeName: 'DampedSpringJoint2D',
  parser: parseNode2D,
};

nodeRegistry.register(dampedSpringJoint2DRegistration);

export { dampedSpringJoint2DRegistration };
