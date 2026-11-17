import type * as THREE from 'three';
import type { ShaderDecoders } from '../preprocessor/decoders.js';
import type { RenderingMethod } from '../preprocessor/preprocessor.js';
import { glVaryingSlots } from './glVaryingSlots.js';
import type { ShaderOptions } from './parseShader.js';

/** The options of the renderer that every shader of its project parses with. */
export type RendererShaderOptions = Pick<ShaderOptions, 'renderingMethod' | 'glVaryings'>;

/** The renderer's options and the decoders a shader's `#if` may decompress with. */
export interface ProjectShaderOptions extends RendererShaderOptions {
  readonly decoders: ShaderDecoders;
}

/** Godot's GLES3 driver reads its varying limit from the context. The Vulkan drivers ignore it. */
export function rendererShaderOptions(
  renderer: THREE.WebGLRenderer,
  renderingMethod: RenderingMethod
): RendererShaderOptions {
  if (renderingMethod !== 'gl_compatibility') return { renderingMethod };
  return { renderingMethod, glVaryings: glVaryingSlots(renderer.getContext() as WebGL2RenderingContext) };
}
