import { unquoteString } from '../../../parser/utils';
import type { ResourceKind } from '../../reading';

/** The text of a Shader, from its `code` or from a `.gdshader` file, which loads as a Shader. */
export const SHADER_CODE: ResourceKind<string> = {
  name: 'ShaderCode',
  accepts: (type) => type === 'Shader',
  decode: ({ properties }) => shaderCodeOf(properties),
};

/** The code with Godot's string escapes decoded (`variant_parser.cpp:299-351`). */
export function shaderCodeOf(properties: Readonly<Record<string, string>>): string {
  return unquoteString(properties['code'] ?? '""');
}
