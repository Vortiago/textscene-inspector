import type { ScopedReference } from '../reading';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { variantToText } from '../../godot/variant/variantWriter';
import { skyMaterialShader } from '../../shaders/sky/materials/skyMaterialShader';
import type { ShaderSkyText } from './types';

/** Null for a class with no generator. `textures` resolve in the material's own file. */
export function skyMaterialText(
  type: string,
  properties: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, ScopedReference>>
): ShaderSkyText | null {
  const values = Object.fromEntries(
    Object.entries(properties)
      .filter(([name]) => !Object.hasOwn(textures, name))
      .map(([name, text]) => [name, textToVariant(text)])
  );
  const shader = skyMaterialShader(type, { properties: values, textures: new Set(Object.keys(textures)) });
  if (!shader) return null;
  return {
    code: shader.code,
    // Godot's generated shader has no path, so a fault names the material's class.
    file: type,
    parameters: Object.fromEntries(
      Object.entries(shader.parameters).map(([name, value]) => [name, variantToText(value)])
    ),
    textures: Object.fromEntries(
      Object.entries(shader.textureUniforms)
        .filter(([property]) => Object.hasOwn(textures, property))
        .map(([property, uniform]) => [uniform, textures[property]!])
    ),
  };
}
