/** The mode a Shader or a VisualShader runs in, from any origin. */

import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { enumMember, type EnumValue } from '../../../godot/classdb/enumNames.js';
import { literalText, stringToInt } from '../../../godot/string/string';
import type { ResourceKind } from '../../reading';

export const SHADER_MODE: ResourceKind<EnumValue<typeof ShaderMode>> = {
  name: 'ShaderMode',
  accepts: (type) => type === 'Shader' || type === 'VisualShader',
  decode: ({ type, properties }) => {
    // `VisualShader::set_mode` refuses an out-of-range mode (`visual_shader.cpp:1436`), so it keeps the default.
    if (type === 'VisualShader') {
      return enumMember(ShaderMode, stringToInt(properties['mode'] ?? '0')) ?? ShaderMode.SPATIAL;
    }
    return shaderModeOf(literalText(properties['code'] ?? ''));
  },
};
