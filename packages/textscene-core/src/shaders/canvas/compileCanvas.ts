import type { ShaderRefusal } from '../fault/shaderRefusal.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { shaderSamplers, type ShaderSampler } from '../uniforms/shaderSamplers.js';
import { transpileCanvasItem, type CanvasItemOptions, type TranspiledCanvasItem } from './transpileCanvas.js';

export type CanvasCompile =
  | { readonly item: TranspiledCanvasItem; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: ShaderRefusal }
  /** A defect, which is no refusal of the text. */
  | { readonly failure: unknown };

/** The material of `code`, or why it draws none: the parse, the checks or the link refuse it. */
export function compileCanvas(code: string, options: CanvasItemOptions): CanvasCompile {
  try {
    const item = transpileCanvasItem(code, options);
    const declarations = [...item.parameters.values()].map((parameter) => parameter.declaration);
    return { item, samplers: shaderSamplers(declarations) };
  } catch (error) {
    return error instanceof ShadingLanguageError ? { refusal: error } : { failure: error };
  }
}
