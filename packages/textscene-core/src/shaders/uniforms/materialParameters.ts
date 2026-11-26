import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import type { SamplerValue } from './samplerUniform.js';
import type { ParameterValue, TranspiledUniform } from './transpiledUniform.js';

type Uniforms = ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>;

/** Writes each value its uniform takes. Godot ignores a value no uniform declares. */
export function setParameterValues(
  uniforms: Uniforms,
  values: Readonly<Record<string, ParameterValue>>
): void {
  for (const [name, value] of Object.entries(values)) uniforms.get(name)?.set(value);
}

/** Each `shader_parameter/<name>` value of a material's file, read from its Variant text. */
export function parameterVariants(texts: Readonly<Record<string, string>>): Record<string, ParameterValue> {
  return Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, textToVariant(text)]));
}

/** Writes each value a material's file and its textures give a uniform. */
export function setMaterialParameters(
  uniforms: Uniforms,
  texts: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, SamplerValue>>
): void {
  setParameterValues(uniforms, { ...parameterVariants(texts), ...textures });
}
