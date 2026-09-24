/**
 * Registers the OpenXRInteractionProfileEditor parser, which reuses HBoxContainer's. It registers no
 * component, so the dispatcher falls back to GenericNodeFallback and the tree reports it as not
 * implemented. Its validators live in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHBoxContainer } from '../hboxcontainer/parser';

const openXRInteractionProfileEditorRegistration: NodeTypeRegistration = {
  typeName: 'OpenXRInteractionProfileEditor',
  parser: parseHBoxContainer,
};

nodeRegistry.register(openXRInteractionProfileEditorRegistration);

export { openXRInteractionProfileEditorRegistration };
