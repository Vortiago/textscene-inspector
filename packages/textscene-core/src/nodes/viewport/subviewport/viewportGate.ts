/**
 * What the live tree says about the update mode of a SubViewport or an embedded window: a
 * SubViewportContainer parent replaces the authored mode, and the parent viewport decides a
 * WHEN_PARENT_VISIBLE pass.
 */
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { SubViewportUpdateMode } from '../../../godot/scene/viewport.js';
import { isShownCanvasNode } from '../../../r3f/canvasScopes.js';
import { isCanvasLayerType } from '../../../r3f/canvasPaintOrder.js';
import type { LiveTree } from '../../../r3f/liveSceneTree.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import type { TscnNode } from '../../../parser/types.js';
import type { SubViewportContainerProperties } from '../../2d/ui/subviewportcontainer/types.js';
import { isEmbeddableWindow, isViewportBoundary } from './viewportBoundary.js';
import { windowEmbedderPathAt } from './windowEmbedder.js';

/** A node the visibility climb of a SubViewportContainer reads, with the `visible` the scene authors. */
interface VisibilityLink {
  path: string;
  isShown: boolean;
}

/** What the live tree says of a SubViewport's update mode. */
export interface ViewportGate {
  /** The mode the scene authors. */
  authoredMode: number;
  /** The parent viewport whose passes gate this one, null at the root viewport. */
  enclosingPath: string | null;
  /**
   * The nodes whose `visible` decides a SubViewportContainer parent, the container first, null
   * under any other parent. Which nodes the climb reads depends on types alone, so an animated
   * `visible` replaces the authored value of a link and leaves the chain as it is.
   */
  visibilityChain: readonly VisibilityLink[] | null;
  /**
   * Whether the parent is a stretching SubViewportContainer, which sizes the viewport after its
   * layout. A render before that rect lands is at the authored size and spends the ONCE clear
   * (`subviewport_container.cpp:94`, `renderer_viewport.cpp:375`).
   */
  isStretched: boolean;
}

/** The gate once an animated `visible` is laid over the chain: the mode a pass renders by. */
export interface UpdateGate {
  updateMode: number;
  enclosingPath: string | null;
}

export function viewportGateAt(tree: LiveTree, path: string, authoredMode: number): ViewportGate {
  const parentPath = parentPathOf(path);
  const container = parentPath === null ? undefined : tree.at(parentPath)?.step.node;
  const isUnderContainer = parentPath !== null && container?.type === 'SubViewportContainer';
  return {
    authoredMode,
    enclosingPath: enclosingViewportPathAt(tree, path),
    visibilityChain: isUnderContainer ? visibilityChainAt(tree, parentPath) : null,
    isStretched: isUnderContainer && isStretching(container),
  };
}

/** The gate of a viewport with no live tree: the authored mode stands and the viewport is the root. */
export function ungatedViewport(authoredMode: number): ViewportGate {
  return { authoredMode, enclosingPath: null, visibilityChain: null, isStretched: false };
}

function isStretching(container: TscnNode): boolean {
  return (container.properties as SubViewportContainerProperties).stretch === true;
}

/**
 * The mode `gate` renders by. A SubViewportContainer parent sets ALWAYS while it is visible in
 * the tree and DISABLED while it is not (`subviewport_container.cpp:116-128`), whatever the
 * authored mode says. `animatedVisible` holds the `visible` an AnimationPlayer drives, by path.
 * A stretched viewport whose container has not yet published its rect (`hasStretchedRect` false)
 * renders nothing, so its first render is at the size Godot draws it.
 */
export function resolveGate(
  gate: ViewportGate,
  animatedVisible: ReadonlyMap<string, boolean>,
  hasStretchedRect: boolean
): UpdateGate {
  const { authoredMode, enclosingPath, visibilityChain, isStretched } = gate;
  if (isStretched && !hasStretchedRect) {
    return { updateMode: SubViewportUpdateMode.DISABLED, enclosingPath };
  }
  if (visibilityChain === null) return { updateMode: authoredMode, enclosingPath };
  const isVisible = visibilityChain.every((link) => animatedVisible.get(link.path) ?? link.isShown);
  return {
    updateMode: isVisible ? SubViewportUpdateMode.ALWAYS : SubViewportUpdateMode.DISABLED,
    enclosingPath,
  };
}

/**
 * The viewport whose passes gate the one at `path`, null at the root viewport. A viewport's parent
 * is the viewport it sits in (`viewport.cpp:579`). An embedded window's is its embedder
 * (`viewport.cpp:339`): the nearest viewport above that embeds windows (`window.cpp:1400-1420`).
 */
function enclosingViewportPathAt(tree: LiveTree, path: string): string | null {
  const node = tree.at(path)?.step.node;
  if (node !== undefined && isEmbeddableWindow(node)) return windowEmbedderPathAt(tree, path);
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const aboveNode = tree.at(above)?.step.node;
    if (aboveNode && isViewportBoundary(aboveNode.type)) return above;
  }
  return null;
}

/**
 * The nodes `CanvasItem::is_visible_in_tree()` reads for `path`: the node's own `visible` and the
 * visibility of its parent. The climb ends at a parent that is no CanvasItem. A CanvasLayer answers
 * with its own `visible` and a Node answers true (`canvas_item.cpp:330-350`). A node the tree lacks
 * counts as hidden.
 */
function visibilityChainAt(tree: LiveTree, path: string): VisibilityLink[] {
  const node = tree.at(path)?.step.node;
  if (!node) return [{ path, isShown: false }];
  const chain = [{ path, isShown: isShownCanvasNode(node) }];
  const parentPath = parentPathOf(path);
  const parent = parentPath === null ? undefined : tree.at(parentPath)?.step.node;
  if (!parent) return chain;
  if (isCanvasLayerType(parent.type)) {
    return [...chain, { path: parentPath!, isShown: isShownCanvasNode(parent) }];
  }
  return descendsFromClass(parent.type, 'CanvasItem')
    ? [...chain, ...visibilityChainAt(tree, parentPath!)]
    : chain;
}
