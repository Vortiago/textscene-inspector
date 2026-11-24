const DEBUG_RENDERER_EXTENSION = 'WEBGL_debug_renderer_info';

/** What Chrome's plain `RENDERER` says, whatever draws. */
const MASKED_RENDERER = 'WebKit WebGL';

/**
 * Null for a context that names none; the debug extension only for Chrome's mask, which Firefox deprecates.
 * @canonical The name of the GPU a WebGL context draws on
 */
export function glRendererName(gl: WebGL2RenderingContext): string | null {
  let renderer: unknown = gl.getParameter(gl.RENDERER);
  if (renderer === MASKED_RENDERER) {
    const debug = gl.getExtension(DEBUG_RENDERER_EXTENSION) as { UNMASKED_RENDERER_WEBGL: number } | null;
    if (debug) renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  }
  return typeof renderer === 'string' ? renderer : null;
}
