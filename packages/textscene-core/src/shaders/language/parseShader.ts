/** The front end: a shader's text through the preprocessor and the parser, as Godot compiles a `Shader`. */

import { preprocess, type PreprocessOptions } from '../preprocessor/preprocessor.js';
import { PreprocessorError } from '../preprocessor/preprocessorError.js';
import { parse } from './parse.js';
import type { ShaderNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

/** How a caller names the shader, reads its includes and sets the renderer its directives see. */
export type ShaderOptions = PreprocessOptions;

/**
 * The text `Shader::set_code` hands to the compiler (`shader.cpp:91`): the preprocessed text,
 * or the shader's own text when the preprocessor refuses it, which the compiler refuses at its
 * first `#`.
 */
export function shaderCode(source: string, options: ShaderOptions = {}): string {
  try {
    return preprocess(source, options);
  } catch (error) {
    if (error instanceof PreprocessorError) return source;
    throw error;
  }
}

export function parseShader(source: string, options: ShaderOptions = {}): ShaderNode {
  return parse(tokenize(shaderCode(source, options), options.file ?? ''));
}
