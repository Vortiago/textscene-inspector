/**
 * Which node types are viewport boundaries: a sub-viewport's canvas subtree is
 * dispatched by its viewport surface, never by the parent's walker (ADR-0033). A
 * leaf module, free of THREE, React and the registry. The 3D canvas still passes
 * a sub-viewport through, since Godot shares the parent's World3D.
 */

/** Godot `Viewport` subclasses authorable in a `.tscn`. `Window` is not supported. */
export const VIEWPORT_TYPES: ReadonlySet<string> = new Set(['SubViewport']);

/** True when this type scopes its canvas subtree to its own viewport surface. */
export function isViewportBoundary(type: string): boolean {
  return VIEWPORT_TYPES.has(type);
}

/**
 * Controls that display a sub-viewport's target: the viewport surfaces. The 3D
 * workspace drops a 2D-UI subtree, but a surface's subtree can hold a sub-viewport's
 * 3D content, which Godot draws in the 3D view unless `own_world_3d`. So the drop
 * rule subtracts this set.
 */
export const VIEWPORT_SURFACE_TYPES: ReadonlySet<string> = new Set(['SubViewportContainer']);

/** True when this Control displays a sub-viewport and must pass 3D content through. */
export function isViewportSurface(type: string): boolean {
  return VIEWPORT_SURFACE_TYPES.has(type);
}
