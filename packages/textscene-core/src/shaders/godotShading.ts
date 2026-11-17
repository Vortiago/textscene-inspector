import type * as THREE from 'three';
import { rendererShaderOptions, type RendererShaderOptions } from './language/rendererShaderOptions.js';
import { installNodesHandler, type NodeOutput } from './nodesHandler.js';
import type { RenderingMethod } from './preprocessor/preprocessor.js';
import { transpileSky, type SkyOptions, type TranspiledSky } from './sky/transpileSky.js';
import { transpileSpatial, type SpatialOptions, type TranspiledSpatial } from './spatial/transpileSpatial.js';

export interface GodotShadingOptions {
  /** What a node material writes, `display` when left out. */
  readonly output?: NodeOutput;
  /** The project's `rendering/renderer/rendering_method`, `forward_plus` when left out. */
  readonly renderingMethod?: RenderingMethod;
}

/** A shader's own options: its file, includes and decoders. The renderer gives the rest. */
type OwnOptions<Options> = Omit<Options, keyof RendererShaderOptions>;

export interface GodotShading {
  readonly shaderOptions: RendererShaderOptions;
  /** The material of a shader of `shader_type spatial`. */
  spatial(source: string, options?: OwnOptions<SpatialOptions>): TranspiledSpatial;
  /** The draws of a shader of `shader_type sky`. */
  sky(source: string, options?: OwnOptions<SkyOptions>): TranspiledSky;
}

/** Gives `renderer` a nodes handler, and answers the shading of its project. */
export function installGodotShading(
  renderer: THREE.WebGLRenderer,
  { output, renderingMethod = 'forward_plus' }: GodotShadingOptions = {}
): GodotShading {
  installNodesHandler(renderer, output);
  const shaderOptions = rendererShaderOptions(renderer, renderingMethod);
  return {
    shaderOptions,
    spatial: (source, options) => transpileSpatial(source, { ...options, ...shaderOptions }),
    sky: (source, options) => transpileSky(source, { ...options, ...shaderOptions }),
  };
}
