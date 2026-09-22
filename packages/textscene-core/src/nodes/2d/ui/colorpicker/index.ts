/**
 * ColorPicker registration: parser.
 *
 * Parses VBoxContainer's own properties plus `color`/`picker_shape`; the
 * rest of ColorPicker's own members live in linterParser.ts only.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorPicker } from './parser';

const colorPickerRegistration: NodeTypeRegistration = {
  typeName: 'ColorPicker',
  parser: parseColorPicker,
};

nodeRegistry.register(colorPickerRegistration);

export { colorPickerRegistration };
