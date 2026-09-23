/**
 * ColorPicker registration: the parser, which reads the VBoxContainer
 * properties and the ColorPicker members that change a drawn row.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorPicker } from './parser';

const colorPickerRegistration: NodeTypeRegistration = {
  typeName: 'ColorPicker',
  parser: parseColorPicker,
};

nodeRegistry.register(colorPickerRegistration);

export { colorPickerRegistration };
