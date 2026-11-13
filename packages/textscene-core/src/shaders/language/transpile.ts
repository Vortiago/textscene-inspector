/**
 * The transpiler of Godot's shading language to three.js TSL: a shader text in, its functions as
 * TSL out. A text Godot refuses, or a construct not transpiled yet, throws `ShadingLanguageError`.
 */

import { emitFunction, type TranspiledFunction } from './emitter.js';
import { parse } from './parse.js';
import { tokenize } from './tokenizer.js';

export interface TranspiledShader {
  /** Each function of the text, by name. */
  readonly functions: ReadonlyMap<string, TranspiledFunction>;
}

export function transpileShadingLanguage(source: string): TranspiledShader {
  const tree = parse(tokenize(source));
  return {
    functions: new Map(tree.functions.map((definition) => [definition.name, emitFunction(definition)])),
  };
}
