/**
 * Which node types are **viewport boundaries** — a sub-viewport's subtree is
 * dispatched by its viewport surface (a `SubViewportContainer`, or a
 * `ViewportTexture` consumer), never by the parent's own walker (ADR-0030).
 *
 * Lives here, next to the slice that defines the behaviour, rather than in a
 * central set, and stays a leaf module so every consumer can read it without
 * pulling in THREE, React or the registry.
 *
 * Note this is NOT the same question as "does the 3D canvas skip it". The 3D
 * canvas deliberately passes a sub-viewport through, because Godot shares the
 * parent's World3D (`Viewport::find_world_3d`); the boundary here is the
 * **canvas** one, which Godot always enforces.
 */

/** Godot `Viewport` subclasses authorable in a `.tscn`. `Window` is not supported. */
export const VIEWPORT_TYPES: ReadonlySet<string> = new Set(['SubViewport']);

/** True when this type scopes its canvas subtree to its own viewport surface. */
export function isViewportBoundary(type: string): boolean {
  return VIEWPORT_TYPES.has(type);
}

/**
 * Controls that DISPLAY a sub-viewport's target — the viewport surfaces.
 *
 * These are the one exception to "the 3D workspace drops CanvasItem subtrees".
 * A surface is a Control, so `is2DUIType` claims it. But dropping its SUBTREE in
 * the 3D workspace would take a contained sub-viewport's 3D content with it, and
 * that content really does draw in Godot's 3D view — a sub-viewport shares the
 * parent's World3D unless `own_world_3d` (`Viewport::find_world_3d`).
 *
 * So the two questions — "is this 2D UI" and "does the 3D canvas skip it" —
 * diverge here, which is why the drop rule subtracts this set rather than
 * reading the 2D-UI answer alone.
 */
export const VIEWPORT_SURFACE_TYPES: ReadonlySet<string> = new Set(['SubViewportContainer']);

/** True when this Control displays a sub-viewport and must pass 3D content through. */
export function isViewportSurface(type: string): boolean {
  return VIEWPORT_SURFACE_TYPES.has(type);
}
