/**
 * ColorPicker registration: parser.
 *
 * Reuses the VBoxContainer parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVBoxContainer } from '../vboxcontainer/parser';

const colorPickerRegistration: NodeTypeRegistration = {
  typeName: 'ColorPicker',
  parser: parseVBoxContainer,
};

nodeRegistry.register(colorPickerRegistration);

export { colorPickerRegistration };
