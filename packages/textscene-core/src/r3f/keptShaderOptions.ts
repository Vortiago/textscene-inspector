import type { ShaderDecoders } from '../shaders/preprocessor/decoders.js';
import type { ProjectShaderOptions, RendererShaderOptions } from '../shaders/rendererShaderOptions.js';
import { perObject } from '../utils/perObject.js';

/** Written only by `projectShaderOptionsOf`: one object for each decoders and renderer options. */
const optionsOf = perObject((_decoders: ShaderDecoders) => new Map<string, ProjectShaderOptions>());

/** One object for equal options, as each compile and read sky is kept for its options object. */
export function projectShaderOptionsOf(
  decoders: ShaderDecoders,
  renderer: RendererShaderOptions
): ProjectShaderOptions {
  const kept = optionsOf(decoders);
  const key = `${renderer.renderingMethod ?? 'forward_plus'}:${renderer.glVaryings}`;
  const options = kept.get(key) ?? { decoders, ...renderer };
  kept.set(key, options);
  return options;
}
