/**
 * Window parser registration: the Window parse, which reads the Window class defaults. Property
 * knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWindow } from './parser';

const windowRegistration: NodeTypeRegistration = {
  typeName: 'Window',
  parser: parseWindow,
};

nodeRegistry.register(windowRegistration);
