import type { Variant } from '../../godot/variant/value/variant.js';
import { fragmentFunction, helperFunctions } from './fragmentFunction.js';
import { keyText, type MaterialKey } from './materialKey.js';
import { materialParameters, textureParameterOf } from './materialParameters.js';
import { materialStateOf, type MaterialClass } from './materialProperties.js';
import { materialSettingsOf } from './materialSettings.js';
import { materialUniforms } from './materialUniforms.js';
import { originComment, renderModes } from './renderModes.js';
import { vertexFunction } from './vertexFunction.js';

/** A scene holds a few dozen keys, and a key past the bound is written again in under a millisecond. */
export const CACHED_TEXTS = 256;

/** Written only by `shaderTextOf`, most recently read last. It drops the oldest past `CACHED_TEXTS`. */
const textsByKey = new Map<string, string>();

/**
 * The shading language text `BaseMaterial3D::_update_shader` writes for key `key` (`material.cpp:685`).
 * @canonical Write the shader text of a StandardMaterial3D or an ORMMaterial3D.
 */
export function shaderTextOf(key: MaterialKey): string {
  const id = keyText(key);
  const text = textsByKey.get(id) ?? writeShaderText(key);
  textsByKey.delete(id);
  textsByKey.set(id, text);
  if (textsByKey.size > CACHED_TEXTS) textsByKey.delete(textsByKey.keys().next().value!);
  return text;
}

function writeShaderText(key: MaterialKey): string {
  return (
    originComment(key) +
    renderModes(key) +
    materialUniforms(key) +
    vertexFunction(key) +
    helperFunctions(key) +
    fragmentFunction(key)
  );
}

/** A BaseMaterial3D as its shader draws it: Godot's text, and the value of each of its parameters. */
export interface BaseMaterialSurface<Texture> {
  readonly code: string;
  readonly parameters: Readonly<Record<string, Variant>>;
  /** Each texture of the material, under its sampler parameter's name. */
  readonly textures: Readonly<Record<string, Texture>>;
}

/** The shader of a `materialClass` whose file writes `properties`, with `textures` by property. */
export function baseMaterialSurface<Texture>(
  materialClass: MaterialClass,
  properties: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, Texture>>
): BaseMaterialSurface<Texture> {
  const state = materialStateOf(materialClass, materialSettingsOf(properties));
  return {
    code: shaderTextOf(state.key),
    parameters: materialParameters(state),
    textures: texturesByParameter(textures),
  };
}

function texturesByParameter<Texture>(
  byProperty: Readonly<Record<string, Texture>>
): Record<string, Texture> {
  const textures: Record<string, Texture> = {};
  for (const [property, texture] of Object.entries(byProperty)) {
    const parameter = textureParameterOf(property);
    if (parameter) textures[parameter] = texture;
  }
  return textures;
}
