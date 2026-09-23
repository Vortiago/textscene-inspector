/**
 * Registers the OpenXRBindingModifierEditor parser, which reuses PanelContainer's. It registers no
 * component, so the dispatcher falls back to GenericNodeFallback and the tree reports it as not
 * implemented. Its validators live in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanelContainer } from '../panelcontainer/parser';

const openXRBindingModifierEditorRegistration: NodeTypeRegistration = {
  typeName: 'OpenXRBindingModifierEditor',
  parser: parsePanelContainer,
};

nodeRegistry.register(openXRBindingModifierEditorRegistration);

export { openXRBindingModifierEditorRegistration };
