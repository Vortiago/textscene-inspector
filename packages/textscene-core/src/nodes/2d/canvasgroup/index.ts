/**
 * CanvasGroup registration: the parser. linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCanvasGroup } from './parser';

const canvasGroupRegistration: NodeTypeRegistration = {
  typeName: 'CanvasGroup',
  parser: parseCanvasGroup,
};

nodeRegistry.register(canvasGroupRegistration);

export * from './parser';
export * from './types';
