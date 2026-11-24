import type { ShaderRefusal } from '../fault/shaderRefusal.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { shaderSamplers, type ShaderSampler } from '../uniforms/shaderSamplers.js';
import { parsedShader } from '../language/parseShader.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { transpileParsedSpatial, type SpatialOptions, type TranspiledSpatial } from './transpileSpatial.js';

export type SpatialCompile =
  | { readonly spatial: TranspiledSpatial; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: ShaderRefusal }
  /** A defect, which is no refusal of the text. */
  | { readonly failure: unknown };

/** The material of `code`, or why it draws none: the parse, the checks or the link can refuse it. */
export function compileSpatial(code: string, options: SpatialOptions): SpatialCompile {
  try {
    const parsed = parsedShader(code, options);
    if (!isUnshaded(parsed.tree)) return { refusal: LIT_SURFACE };
    const spatial = transpileParsedSpatial(parsed, options);
    const declarations = [...spatial.parameters.values()].map((parameter) => parameter.declaration);
    return { spatial, samplers: shaderSamplers(declarations) };
  } catch (error) {
    return error instanceof ShadingLanguageError ? { refusal: error } : { failure: error };
  }
}

/** A lit surface runs Godot's light loop, which the transpiler does not port yet. */
const LIT_SURFACE: ShaderRefusal = {
  message:
    'the shader is lit, as it has no `render_mode unshaded`, and the light loop is not ported yet (T15)',
  owner: '#1453',
};

function isUnshaded(tree: ShaderNode): boolean {
  return tree.renderModes.some((mode) => mode.name === 'unshaded');
}
