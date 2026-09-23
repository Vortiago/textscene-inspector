/**
 * Registers the Parallax2D parser. It reuses the Node2D parse, and its property
 * knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const parallax2DRegistration: NodeTypeRegistration = {
  typeName: 'Parallax2D',
  parser: parseNode2D,
};

nodeRegistry.register(parallax2DRegistration);

export { parallax2DRegistration };
