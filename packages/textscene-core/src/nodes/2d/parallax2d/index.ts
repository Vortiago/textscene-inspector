/** Registers the Parallax2D parser. Its property knowledge for the linter lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseParallax2D } from './parser';

const parallax2DRegistration: NodeTypeRegistration = {
  typeName: 'Parallax2D',
  parser: parseParallax2D,
};

nodeRegistry.register(parallax2DRegistration);

export * from './parser';
export * from './types';
