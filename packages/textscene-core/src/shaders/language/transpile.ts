/**
 * The transpiler of Godot's shading language to three.js TSL: a shader text in, its functions as
 * TSL out. A text Godot refuses, or a construct not transpiled yet, throws `ShadingLanguageError`.
 */

import { emitShader, type TranspiledFunction } from './emitter.js';
import { parse } from './parse.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { tokenize } from './tokenizer.js';
import { checkTranspiled } from './transpiledRows.js';

/** The entry that draws each shader type whose shader links into a template of Godot's. */
const TEMPLATE_ENTRIES: Readonly<Record<string, string>> = { sky: 'transpileSky' };

export interface TranspiledShader {
  /** Each function of the text, by Godot's name: `f`, then `f@2` for its first overload. */
  readonly functions: ReadonlyMap<string, TranspiledFunction>;
}

/** The functions of `source`. `file` names the shader in the position of an error. */
export function transpileShadingLanguage(source: string, file = ''): TranspiledShader {
  const tree = parse(tokenize(source, file));
  checkTranspiled(tree);
  const entry = tree.shaderType && TEMPLATE_ENTRIES[tree.shaderType];
  if (entry)
    throw new ShadingLanguageError(
      `a shader of 'shader_type ${tree.shaderType}' links into Godot's ${tree.shaderType} template: draw it with ${entry}`,
      tree.headPosition!
    );
  return { functions: emitShader(tree) };
}
