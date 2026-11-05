/**
 * PopupPanel parser registration: the Window parse, which reads the PopupPanel class defaults. Property
 * knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWindow } from '../window/parser';

const popupPanelRegistration: NodeTypeRegistration = {
  typeName: 'PopupPanel',
  parser: parseWindow,
};

nodeRegistry.register(popupPanelRegistration);
