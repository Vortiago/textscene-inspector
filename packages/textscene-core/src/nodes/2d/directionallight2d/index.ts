/**
 * DirectionalLight2D registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const directionalLight2DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight2D',
  parser: parseNode2D,
};

nodeRegistry.register(directionalLight2DRegistration);

export { directionalLight2DRegistration };
