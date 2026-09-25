/**
 * CanvasGroup registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const canvasGroupRegistration: NodeTypeRegistration = {
  typeName: 'CanvasGroup',
  parser: parseNode2D,
};

nodeRegistry.register(canvasGroupRegistration);

export { canvasGroupRegistration };
