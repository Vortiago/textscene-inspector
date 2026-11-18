import type * as THREE from 'three';
import { glVaryingSlots } from './glVaryingSlots.js';
import type { ShaderDecoders } from './preprocessor/decoders.js';
import { rendererOf, type RenderingMethod } from './preprocessor/renderingMethod.js';

/** The options of the renderer that every shader of its project parses with. */
export interface RendererShaderOptions {
  /** `forward_plus` when left out. */
  readonly renderingMethod?: RenderingMethod;
  /** The varying slots of the GL context, which only `gl_compatibility` reads. */
  readonly glVaryings?: number;
}

/** The renderer's options and the decoders a shader's `#if` may decompress with. */
export interface ProjectShaderOptions extends RendererShaderOptions {
  readonly decoders: ShaderDecoders;
}

/** Godot's GLES3 driver reads its varying limit from the context. The Vulkan drivers ignore it. */
export function rendererShaderOptions(
  renderer: THREE.WebGLRenderer,
  renderingMethod: RenderingMethod
): RendererShaderOptions {
  if (rendererOf(renderingMethod) !== 'gl_compatibility') return { renderingMethod };
  return { renderingMethod, glVaryings: glVaryingSlots(renderer.getContext() as WebGL2RenderingContext) };
}
