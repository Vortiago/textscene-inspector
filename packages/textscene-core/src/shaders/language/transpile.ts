import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import { bindParameters, type TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { emitShader, type TranspiledFunction } from './emitter.js';
import { withGlslTypes } from './glslTypes.js';
import { parsedShader, type ParsedShader, type ShaderOptions } from './parseShader.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { checkTranspiled } from './transpiledRows.js';

/** The entry that draws each shader type whose shader links into a template of Godot's. */
const TEMPLATE_ENTRIES: Readonly<Record<string, string>> = { sky: 'transpileSky' };

export interface TranspiledShader {
  /** Each function of the text, by Godot's name: `f`, then `f@2` for its first overload. */
  readonly functions: ReadonlyMap<string, TranspiledFunction>;
  /** Each uniform by name, in the order of the text, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
}

export interface TranspileOptions extends ShaderOptions {
  /** Godot's `p_use_linear_color`: false only for a `canvas_item` outside an HDR 2D viewport. */
  readonly useLinearColor?: boolean;
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
}

/** The functions and uniforms of `source`, preprocessed with `options`. */
export function transpileShadingLanguage(source: string, options: TranspileOptions = {}): TranspiledShader {
  return transpileParsedShader(parsedShader(source, options), options);
}

/** The functions and uniforms of a parsed shader, for a caller that has read its tree already. */
export function transpileParsedShader(
  { tree }: ParsedShader,
  { useLinearColor = isLinearByDefault(tree.shaderType), sampling = GODOT_SAMPLING }: TranspileOptions = {}
): TranspiledShader {
  checkTranspiled(tree);
  const entry = tree.shaderType && TEMPLATE_ENTRIES[tree.shaderType];
  if (entry)
    throw new ShadingLanguageError(
      `a shader of 'shader_type ${tree.shaderType}' links into Godot's ${tree.shaderType} template: draw it with ${entry}`,
      tree.headPosition!
    );
  const parameters = bindParameters(tree, { useLinearColor, sampling });
  const values = new Map([...parameters].map(([name, binding]) => [name, binding.value]));
  return { functions: emitShader(withGlslTypes(tree), values), parameters };
}

/** A text with no head is a probe's, which Godot draws as a `canvas_item` in a viewport without HDR. */
const isLinearByDefault = (shaderType: string | undefined) =>
  shaderType !== undefined && shaderType !== 'canvas_item';
