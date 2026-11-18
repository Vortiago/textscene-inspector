import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import type { SamplerValue } from './samplerUniform.js';
import type { TranspiledUniform } from './transpiledUniform.js';

/** Writes each value its uniform takes. Godot ignores a value no uniform declares. */
export function setMaterialParameters(
  uniforms: ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>,
  texts: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, SamplerValue>>
): void {
  for (const [name, text] of Object.entries(texts)) uniforms.get(name)?.set(textToVariant(text));
  for (const [name, texture] of Object.entries(textures)) uniforms.get(name)?.set(texture);
}
