import { preprocess, type PreprocessOptions } from '../preprocessor/preprocessor.js';
import { PreprocessorError } from '../preprocessor/preprocessorError.js';
import { parse } from './parse.js';
import type { ShaderNode } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

export type ShaderOptions = PreprocessOptions;

// A refused text goes to the compiler as it is, which refuses its first `#` (shader.cpp:91).
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
