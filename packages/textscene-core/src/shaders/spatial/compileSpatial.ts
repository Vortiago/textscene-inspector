import type { ShaderRefusal } from '../fault/shaderRefusal.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { shaderSamplers, type ShaderSampler } from '../uniforms/shaderSamplers.js';
import { transpileSpatial, type SpatialOptions, type TranspiledSpatial } from './transpileSpatial.js';

export type SpatialCompile =
  | { readonly spatial: TranspiledSpatial; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: ShaderRefusal }
  /** A defect, which is no refusal of the text. */
  | { readonly failure: unknown };

/** The material of `code`, or why it draws none: the parse, the checks or the link can refuse it. */
export function compileSpatial(code: string, options: SpatialOptions): SpatialCompile {
  try {
    const spatial = transpileSpatial(code, options);
    const declarations = [...spatial.parameters.values()].map((parameter) => parameter.declaration);
    return { spatial, samplers: shaderSamplers(declarations) };
  } catch (error) {
    return error instanceof ShadingLanguageError ? { refusal: error } : { failure: error };
  }
}
