/**
 * Whether a WebGL context draws on the CPU. A browser that turns its GPU off still runs WebGL in a
 * software rasteriser, and every scene then costs many times its GPU frame time.
 */

const DEBUG_RENDERER_EXTENSION = 'WEBGL_debug_renderer_info';

/**
 * Chrome and Edge rasterise through SwiftShader, Firefox on Linux through Mesa's llvmpipe or
 * softpipe, and Windows without a GPU driver through the Microsoft Basic Render Driver.
 */
const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render Driver/i;

export function isSoftwareRendererName(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer);
}

/**
 * Reads the renderer the context names. The plain `RENDERER` is a fixed string in Chrome, so the
 * unmasked name comes first where the debug extension offers it.
 */
export function rendersInSoftware(gl: WebGL2RenderingContext): boolean {
  const debug = gl.getExtension(DEBUG_RENDERER_EXTENSION) as { UNMASKED_RENDERER_WEBGL: number } | null;
  const renderer: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  return typeof renderer === 'string' && isSoftwareRendererName(renderer);
}
