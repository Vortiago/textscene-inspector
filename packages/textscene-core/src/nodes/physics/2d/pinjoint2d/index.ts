/**
 * PinJoint2D registration: the parser.
 *
 * It reuses the Node2D parse, and property knowledge lives in linterParser.ts. Its marker
 * has no property to read, so index.r3f.ts draws it from constants.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode2D } from '../../../base/node2d/parser';

const pinJoint2DRegistration: NodeTypeRegistration = {
  typeName: 'PinJoint2D',
  parser: parseNode2D,
};

nodeRegistry.register(pinJoint2DRegistration);
