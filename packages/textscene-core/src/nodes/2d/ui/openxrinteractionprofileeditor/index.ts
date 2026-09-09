/**
 * OpenXRInteractionProfileEditor registration, parser.
 *
 * Reuses the HBoxContainer parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHBoxContainer } from '../hboxcontainer/parser';

const openXRInteractionProfileEditorRegistration: NodeTypeRegistration = {
  typeName: 'OpenXRInteractionProfileEditor',
  parser: parseHBoxContainer,
};

nodeRegistry.register(openXRInteractionProfileEditorRegistration);

export { openXRInteractionProfileEditorRegistration };
