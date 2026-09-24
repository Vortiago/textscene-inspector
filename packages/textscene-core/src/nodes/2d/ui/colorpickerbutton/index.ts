/**
 * ColorPickerButton registration: the parser, which reads the Button
 * properties plus `color`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorPickerButton } from './parser';

const colorPickerButtonRegistration: NodeTypeRegistration = {
  typeName: 'ColorPickerButton',
  parser: parseColorPickerButton,
};

nodeRegistry.register(colorPickerButtonRegistration);

export { colorPickerButtonRegistration };
