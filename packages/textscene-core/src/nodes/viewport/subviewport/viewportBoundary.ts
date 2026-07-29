/**
 * Which node types are **viewport boundaries** — a sub-viewport's subtree is
 * dispatched by its viewport surface (a `SubViewportContainer`, or a
 * `ViewportTexture` consumer), never by the parent's own walker (ADR-0030).
 *
 * Lives here, next to the slice that defines the behaviour, rather than in a
 * central set: it is consulted by the Control overlay walker, the workspace
 * rule, and the linter, and a leaf module keeps the **React-free linter
 * boundary** intact (no THREE, no React, no registry).
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
