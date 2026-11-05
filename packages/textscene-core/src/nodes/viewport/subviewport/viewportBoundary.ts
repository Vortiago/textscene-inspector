/**
 * Which node types are viewport boundaries: a sub-viewport's canvas subtree is
 * dispatched by its viewport surface, never by the parent's walker (ADR-0033). A
 * leaf module, free of THREE, React and the registry. The 3D canvas still passes
 * a sub-viewport through, since Godot shares the parent's World3D.
 */

import { perObject } from '../../../utils/perObject';
import type { TscnNode } from '../../../parser/types';
import type { WindowProperties } from '../../windows/window/types';

/**
 * The `Window` classes an embedder draws with their decoration (`viewport.cpp:342-401`). A
 * window is a `Viewport`, so it owns its World2D and its Controls draw only in its target.
 */
const EMBEDDED_WINDOW_TYPE_NAMES = ['Window', 'Popup', 'PopupPanel'] as const;

/** A `Window` class an embedder draws: the one list the registration helpers take their names from. */
export type EmbeddedWindowType = (typeof EMBEDDED_WINDOW_TYPE_NAMES)[number];

const EMBEDDED_WINDOW_TYPES: ReadonlySet<string> = new Set(EMBEDDED_WINDOW_TYPE_NAMES);

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

/** The fields of a node the embedding tests read. */
type EmbeddingNode = Pick<TscnNode, 'type' | 'properties'>;

/** The viewport and window keys the embedding tests read, absent on a node of another type. */
type EmbeddingProperties = Partial<
  Pick<WindowProperties, 'gui_embed_subwindows' | 'force_native' | 'visible'>
>;

function embeddingProperties(node: EmbeddingNode): EmbeddingProperties {
  return node.properties as EmbeddingProperties;
}

/** Whether a viewport embeds the windows below it: the climb to an embedder stops there. */
export function embedsSubwindows(node: EmbeddingNode): boolean {
  return embeddingProperties(node).gui_embed_subwindows === true;
}

/** Whether an embedder draws this node: a window that is not native, which draws outside the frame. */
export function isEmbeddableWindow(node: EmbeddingNode): boolean {
  return isEmbeddedWindow(node.type) && !embeddingProperties(node).force_native;
}

/** Whether a window registers with its embedder: an embeddable one that is visible (`window.cpp:1546-1563`). */
export function isRegisteredWindow(node: EmbeddingNode): boolean {
  return isEmbeddableWindow(node) && embeddingProperties(node).visible !== false;
}

/**
 * Whether `viewport` draws a window over its canvas: it embeds windows, and one below it climbs to
 * it, past each viewport that embeds none (`Window::get_embedder`). A native window draws outside.
 */
export function embedsAWindow(viewport: TscnNode): boolean {
  return embedsSubwindows(viewport) && reachesEmbedder(viewport.children);
}

/** A hidden window does not register, but its children still climb. */
function reachesEmbedder(nodes: readonly TscnNode[]): boolean {
  return nodes.some(
    (node) => isRegisteredWindow(node) || (!embedsSubwindows(node) && reachesEmbedder(node.children))
  );
}

/**
 * Whether a window may sit at or below `node`, so a walk that only looks for windows can skip a
 * subtree without one. An instanced scene may hold one that its parsed node does not show.
 */
export const mayHoldWindow: (node: TscnNode) => boolean = perObject(
  (node: TscnNode): boolean =>
    isEmbeddedWindow(node.type) || node.instance !== undefined || node.children.some(mayHoldWindow)
);

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
