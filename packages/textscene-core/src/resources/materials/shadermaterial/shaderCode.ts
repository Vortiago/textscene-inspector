import { literalText } from '../../../godot/string/string';
import type { ResourceKind } from '../../reading';

/** The text of a Shader, from its `code` or from a `.gdshader` file, which loads as a Shader. */
export const SHADER_CODE: ResourceKind<string> = {
  name: 'ShaderCode',
  accepts: (type) => type === 'Shader',
  decode: ({ properties }) => shaderCodeOf(properties),
};

export function shaderCodeOf(properties: Readonly<Record<string, string>>): string {
  return literalText(properties['code'] ?? '');
}
