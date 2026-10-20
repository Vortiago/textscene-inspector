/** TouchScreenButton registration: the parser. Property knowledge lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseTouchScreenButton } from './parser';

const touchScreenButtonRegistration: NodeTypeRegistration = {
  typeName: 'TouchScreenButton',
  parser: parseTouchScreenButton,
};

nodeRegistry.register(touchScreenButtonRegistration);

export * from './parser';
export * from './types';
