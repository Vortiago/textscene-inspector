import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { shaderSamplers, type ShaderSampler } from '../uniforms/shaderSamplers.js';
import { transpileSpatial, type SpatialOptions, type TranspiledSpatial } from './transpileSpatial.js';

/** Godot's refusal of a text, or the transpiler's for a construct it does not port yet. */
export type SpatialRefusal = Pick<ShadingLanguageError, 'message' | 'owner'>;

export type SpatialCompile =
  | { readonly spatial: TranspiledSpatial; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: SpatialRefusal }
  /** A defect, which is no refusal of the text. */
  | { readonly failure: unknown };

/** The material of `code`, or why it draws none: a refusal can come from the parse, the checks or the link. */
export function compileSpatial(code: string, options: SpatialOptions): SpatialCompile {
  try {
    const spatial = transpileSpatial(code, options);
    const declarations = [...spatial.parameters.values()].map((parameter) => parameter.declaration);
    return { spatial, samplers: shaderSamplers(declarations) };
  } catch (error) {
    return error instanceof ShadingLanguageError ? { refusal: error } : { failure: error };
  }
}
