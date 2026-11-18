import { parsedShader, type ParsedShader } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import type { ProjectShaderOptions } from '../rendererShaderOptions.js';
import { disposeSky, transpileParsedSky } from './transpileSky.js';

/** Godot's refusal of a text, or the transpiler's for a construct it does not port yet. */
export type SkyRefusal = Pick<ShadingLanguageError, 'message' | 'owner'>;

export type SkyCompile =
  | { readonly parsed: ParsedShader; readonly refusal: null }
  | { readonly refusal: SkyRefusal }
  /** A defect, which is no refusal of the text. */
  | { readonly failure: unknown; readonly refusal: null };

/** A first transpile proves the text, as a refusal can come from the parse, the checks or the link. */
export function compileSky(code: string, options: ProjectShaderOptions): SkyCompile {
  try {
    const parsed = parsedShader(code, options);
    disposeSky(transpileParsedSky(parsed, ''));
    return { parsed, refusal: null };
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) return { failure: error, refusal: null };
    return { refusal: error };
  }
}
