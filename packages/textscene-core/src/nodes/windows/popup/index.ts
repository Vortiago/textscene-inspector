/**
 * Popup parser registration: the Window parse, which reads the Popup class defaults. Property
 * knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWindow } from '../window/parser';

const popupRegistration: NodeTypeRegistration = {
  typeName: 'Popup',
  parser: parseWindow,
};

nodeRegistry.register(popupRegistration);
