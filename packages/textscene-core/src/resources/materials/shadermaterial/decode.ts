import { referenceAddress, type Follow } from '../../reading';
import { resourceRef } from '../../../godot/variant/resourceRef';
import { arrayLiteralBody } from '../../../godot/variant/variantParser';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string/string';
import { SHADER_CODE } from './shaderCode';
import type { ShaderText, ShaderTextureReference } from './types';

const SHADER_PARAMETER = 'shader_parameter/';

/** A ShaderMaterial's shader text, or null while it names no shader or its code is unread. */
export function decodeShaderText(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): ShaderText | null {
  const { shader } = properties;
  if (shader === undefined) return null;
  const code = follow.read(SHADER_CODE, shader).value;
  if (code === undefined || code === null) return null;
  const parameters: Record<string, string> = {};
  const textures: Record<string, ShaderTextureReference> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith(SHADER_PARAMETER)) continue;
    const name = key.slice(SHADER_PARAMETER.length);
    const texture = shaderTextureReference(value, follow);
    if (texture) textures[name] = texture;
    else parameters[name] = value;
  }
  return { code, file: referenceAddress(follow.reference(shader)), parameters, textures };
}

/** A resource, or an array of resources and nulls that holds one resource at least, as a sampler takes. */
function shaderTextureReference(value: string, follow: Follow): ShaderTextureReference | null {
  if (resourceRef(value)) return follow.reference(value);
  const body = arrayLiteralBody(value);
  if (body === null) return null;
  const elements = dropTrailingComma(splitTopLevel(body));
  const isTextureArray =
    elements.some((element) => resourceRef(element)) &&
    elements.every((element) => element === 'null' || resourceRef(element));
  if (!isTextureArray) return null;
  return elements.map((element) => (element === 'null' ? null : follow.reference(element)));
}
