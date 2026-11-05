/**
 * Which node types are viewport boundaries: a sub-viewport's canvas subtree is
 * dispatched by its viewport surface, never by the parent's walker (ADR-0033). A
 * leaf module, free of THREE, React and the registry. The 3D canvas still passes
 * a sub-viewport through, since Godot shares the parent's World3D.
 */

/**
 * The `Window` classes an embedder draws with their decoration (`viewport.cpp:342-401`). A
 * window is a `Viewport`, so it owns its World2D and its Controls draw only in its target.
 */
const EMBEDDED_WINDOW_TYPES: ReadonlySet<string> = new Set(['Window', 'Popup', 'PopupPanel']);

/** True when this type is a `Window` that an embedder can draw. */
export function isEmbeddedWindow(type: string): boolean {
  return EMBEDDED_WINDOW_TYPES.has(type);
}

/** True for a `SubViewport`, the only viewport a `SubViewportContainer` shows (`subviewport_container.cpp:134-145`). */
export function isSubViewport(type: string): boolean {
  return type === 'SubViewport';
}

/** True when this type scopes its canvas subtree to its own viewport surface. */
export function isViewportBoundary(type: string): boolean {
  return isSubViewport(type) || isEmbeddedWindow(type);
}

/** The fields of a viewport node the embedding test reads. */
interface ViewportNode {
  type: string;
  properties: unknown;
  children: readonly ViewportNode[];
}

function embedsSubwindows(node: ViewportNode): boolean {
  return (node.properties as { gui_embed_subwindows?: boolean }).gui_embed_subwindows === true;
}

/**
 * Whether `viewport` draws a window over its canvas: it embeds windows, and one below it climbs to
 * it, past each viewport that embeds none (`Window::get_embedder`). A native window draws outside.
 */
export function embedsAWindow(viewport: ViewportNode): boolean {
  return embedsSubwindows(viewport) && reachesEmbedder(viewport.children);
}

function reachesEmbedder(nodes: readonly ViewportNode[]): boolean {
  return nodes.some(
    (node) =>
      (isEmbeddedWindow(node.type) && !(node.properties as { force_native?: boolean }).force_native) ||
      (!embedsSubwindows(node) && reachesEmbedder(node.children))
  );
}

/**
 * A live-tree walk's descend predicate: true when a node's children share its viewport. A module
 * function, so a memo keyed on the predicate holds.
 */
export function keepsChildrenInViewport(node: { type: string }): boolean {
  return !isViewportBoundary(node.type);
}

/**
 * Controls that display a sub-viewport's target: the viewport surfaces. The 3D
 * workspace drops a 2D-UI subtree, but a surface's subtree can hold a sub-viewport's
 * 3D content, which Godot draws in the 3D view unless `own_world_3d`. So the drop
 * rule subtracts this set.
 */
const VIEWPORT_SURFACE_TYPES: ReadonlySet<string> = new Set(['SubViewportContainer']);

/** True when this Control displays a sub-viewport and must pass 3D content through. */
export function isViewportSurface(type: string): boolean {
  return VIEWPORT_SURFACE_TYPES.has(type);
}
