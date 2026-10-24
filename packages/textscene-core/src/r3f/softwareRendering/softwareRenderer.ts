/**
 * Whether a WebGL context draws on the CPU. A browser that turns its GPU off still runs WebGL in a
 * software rasteriser, and every scene then costs many times its GPU frame time.
 */

const DEBUG_RENDERER_EXTENSION = 'WEBGL_debug_renderer_info';

/**
 * Chrome and Edge rasterise through SwiftShader, Firefox on Linux through Mesa's llvmpipe or
 * softpipe, Windows without a GPU driver through the Microsoft Basic Render Driver, and macOS
 * without a GPU through the Apple Software Renderer.
 */
const SOFTWARE_RENDERER =
  /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render Driver|Apple Software Renderer/i;

/** What Chrome's plain `RENDERER` says, whatever draws. */
const MASKED_RENDERER = 'WebKit WebGL';

/** Whether `name`, a context's renderer, is one that rasterises on the CPU. */
function isSoftwareRendererName(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}

/**
 * The renderer the context names, or null for a context that names none, as a lost one does. Chrome
 * masks the plain `RENDERER`, so only then does this ask for the debug extension: Firefox names the
 * renderer plainly and deprecates the extension.
 */
function rendererName(gl: WebGL2RenderingContext): string | null {
  let renderer: unknown = gl.getParameter(gl.RENDERER);
  if (renderer === MASKED_RENDERER) {
    const debug = gl.getExtension(DEBUG_RENDERER_EXTENSION) as { UNMASKED_RENDERER_WEBGL: number } | null;
    if (debug) renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  }
  return typeof renderer === 'string' ? renderer : null;
}

export function rendersInSoftware(gl: WebGL2RenderingContext): boolean {
  const name = rendererName(gl);
  return name !== null && isSoftwareRendererName(name);
}
