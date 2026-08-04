/**
 * OpenXRBindingModifierEditor registration: parser.
 *
 * Reuses the PanelContainer parse (itself a pass-through to Control's);
 * property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanelContainer } from '../panelcontainer/parser';

const openXRBindingModifierEditorRegistration: NodeTypeRegistration = {
  typeName: 'OpenXRBindingModifierEditor',
  parser: parsePanelContainer,
};

nodeRegistry.register(openXRBindingModifierEditorRegistration);

export { openXRBindingModifierEditorRegistration };
