/** The renderers Godot draws with. */
export type Renderer = 'forward_plus' | 'mobile' | 'gl_compatibility';

/** The project's `rendering/renderer/rendering_method` as written, which Godot's OS reports unchanged. */
export type RenderingMethod = Renderer | (string & {});

/** The renderer that draws `method`: Forward+ for a name of no renderer, as Godot logs and draws it. */
export function rendererOf(method: RenderingMethod): Renderer {
  if (method === 'mobile') return 'mobile';
  return method === 'gl_compatibility' ? 'gl_compatibility' : 'forward_plus';
}
