/**
 * ColorPickerButton registration: parser.
 *
 * Parses Button's own properties plus `color`; property knowledge otherwise
 * lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorPickerButton } from './parser';

const colorPickerButtonRegistration: NodeTypeRegistration = {
  typeName: 'ColorPickerButton',
  parser: parseColorPickerButton,
};

nodeRegistry.register(colorPickerButtonRegistration);

export { colorPickerButtonRegistration };
