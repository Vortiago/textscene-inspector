/**
 * The translator of Godot's shading language to three.js TSL: a shader text in, its functions as
 * TSL out. A text Godot refuses, or a construct not translated yet, throws `ShadingLanguageError`.
 */

import { emitFunction, type TranslatedFunction } from './emitter.js';
import { parse } from './parse.js';
import { tokenize } from './tokenizer.js';

export interface TranslatedShader {
  /** Each function of the text, by name. */
  readonly functions: ReadonlyMap<string, TranslatedFunction>;
}

export function translateShadingLanguage(source: string): TranslatedShader {
  const tree = parse(tokenize(source));
  return {
    functions: new Map(tree.functions.map((definition) => [definition.name, emitFunction(definition)])),
  };
}
