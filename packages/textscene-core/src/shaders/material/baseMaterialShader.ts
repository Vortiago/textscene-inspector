import { fragmentFunction, helperFunctions } from './fragmentFunction.js';
import { keyText, type MaterialKey } from './materialKey.js';
import { materialStateOf, type MaterialClass, type MaterialSettings } from './materialProperties.js';
import { materialUniforms } from './materialUniforms.js';
import { originComment, renderModes } from './renderModes.js';
import { vertexFunction } from './vertexFunction.js';

/** Written only by `shaderTextOf`, one text per key as Godot's `shader_map`. It never clears. */
const textsByKey = new Map<string, string>();

/**
 * The shading language text `BaseMaterial3D::_update_shader` writes for key `key` (`material.cpp:685`).
 * @canonical Write the shader text of a StandardMaterial3D or an ORMMaterial3D.
 */
export function shaderTextOf(key: MaterialKey): string {
  const id = keyText(key);
  let text = textsByKey.get(id);
  if (text === undefined) {
    text = writeShaderText(key);
    textsByKey.set(id, text);
  }
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

/** The shader text of a material of class `materialClass` with the properties `settings`. */
export function baseMaterialShader(materialClass: MaterialClass, settings: MaterialSettings): string {
  return shaderTextOf(materialStateOf(materialClass, settings).key);
}
