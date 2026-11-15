/** The front end of a shader text: Godot's preprocessor, then the shading language tokenizer and parser. */

import { preprocess, type PreprocessOptions } from '../preprocessor/preprocessor.js';
import { PreprocessorError } from '../preprocessor/preprocessorError.js';
import { parse } from './parse.js';
import type { ShaderNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

export type ShaderOptions = PreprocessOptions;

export interface ParsedShader {
  /** The preprocessed text, which the tree's positions count in. */
  readonly code: string;
  readonly tree: ShaderNode;
}

// A refused text goes to the compiler as it is, which refuses its first `#` (shader.cpp:91).
export function shaderCode(source: string, options: ShaderOptions = {}): string {
  try {
    return preprocess(source, options);
  } catch (error) {
    if (error instanceof PreprocessorError) return source;
    throw error;
  }
}

/** The preprocessed text of `source` and its tree. */
export function parsedShader(source: string, options: ShaderOptions = {}): ParsedShader {
  const code = shaderCode(source, options);
  return { code, tree: parse(tokenize(code, options.file ?? '')) };
}
