/**
 * The kind of content a sub-viewport holds, which decides its one publisher. The offscreen pass
 * owns `'3d'` and `'2d'`, with the Controls beside them, and `ControlRasterPass.tsx` owns `'dom'`.
 * Both write one `ViewportTextureRegistry` key, so the split is decided here alone.
 */

import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import { is2DUIType } from '../../../r3f/controls/has2DUIContent.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';
import {
  liveTreeOf,
  type LiveLink,
  type LiveTree,
  type LiveTreeContext,
  type LiveTreeSources,
} from '../../../r3f/liveSceneTree.js';
import { compositeCallPrefix } from '../../../godot/variant/variantParser.js';
import { isViewportBoundary } from './viewportBoundary.js';
import { embedsAWindow } from './windowEmbedder.js';

/**
 * The `i`-suffixed spellings are listed: `Vector2i` is as 2D as `Vector2`, and it
 * is what Godot writes for `frame_coords`, `region_rect` and `size`. Without them
 * such an override matches neither list and falls through to the 3D publisher.
 */
const TWO_D_COMPOSITE = compositeCallPrefix('Vector2', 'Vector2i', 'Transform2D', 'Rect2', 'Rect2i');
const THREE_D_COMPOSITE = compositeCallPrefix(
  'Vector3',
  'Vector3i',
  'Transform3D',
  'Basis',
  'Quaternion',
  'AABB'
);

/**
 * CanvasItem-only property names, each on `CanvasItem` or `Node2D` and on no Node3D
 * class. One among an instance node's own overrides names its sub-scene's world
 * before the sub-scene loads.
 */
const CANVAS_ITEM_ONLY_PROPERTIES: ReadonlySet<string> = new Set([
  'modulate',
  'self_modulate',
  'show_behind_parent',
  'clip_children',
  'texture_filter',
  'texture_repeat',
  'light_mask',
  'z_index',
  'z_as_relative',
  'y_sort_enabled',
  'skew',
]);

/**
 * Which world an instance node's own overrides name, or null when they name
 * neither. The parser keeps them in `rawProperties`, since the node has no type
 * yet. A transform constructor decides alone: `position = Vector2(…)` cannot be a
 * Node3D, and `Transform3D(…)` cannot be a CanvasItem.
 */
function instanceOverrideKind(node: TscnNode): '2d' | '3d' | null {
  const raw = node.rawProperties;
  if (!raw) return null;
  for (const [key, value] of Object.entries(raw)) {
    if (CANVAS_ITEM_ONLY_PROPERTIES.has(key)) return '2d';
    if (TWO_D_COMPOSITE.test(value)) return '2d';
    if (THREE_D_COMPOSITE.test(value)) return '3d';
  }
  return null;
}

export type ViewportContentKind =
  /** Node3D content, rendered through a `Camera3D` descendant. */
  | '3d'
  /** 2D-world (CanvasItem, non-Control) content, rendered through an ortho camera framing the target. */
  | '2d'
  /** No world content: Controls, if any, drawn by the native Control-raster pass (`ControlRasterPass.tsx`). */
  | 'dom';

/**
 * What a sub-viewport holds: the kind its pass draws, and whether Controls and 2D-world items sit
 * beside that kind.
 */
export interface ViewportContent {
  kind: ViewportContentKind;
  /** Whether the subtree holds a Control. */
  holdsControls: boolean;
  /** Whether the subtree holds a CanvasItem that is no Control. A 3D pass draws it over its world. */
  holdsCanvasItems: boolean;
}

/**
 * Classify a sub-viewport's subtree. Precedence is 3D > 2D > DOM, and the world pass draws one
 * kind. Controls and 2D items beside a 3D world draw over it in a canvas pass, as Godot's canvas
 * items draw after its 3D render (`renderer_viewport.cpp:380-715`). A nested sub-viewport draws
 * into its own target, so it is not descended into.
 */
function classify(node: TscnNode, drawsAWindow: boolean): ViewportContent {
  let sawCanvasItem = false;
  // The embedder draws its windows over its canvas, with the Controls (`EmbeddedWindows.tsx`).
  let sawDom = drawsAWindow;
  let sawUntypedInstance = false;

  // Every child is visited, so `sawDom` is complete when a 3D node comes first.
  const hasNode3DContent = (nodes: readonly TscnNode[]): boolean => {
    let found = false;
    for (const child of nodes) {
      if (isNode3DContent(child)) found = true;
    }
    return found;
  };

  const isNode3DContent = (child: TscnNode): boolean => {
    if (isViewportBoundary(child.type)) return false;
    // Godot's question (`is2DUIType`), not the component registry's: a Control
    // with no component of its own, such as `ProgressBar`, still gets a pass.
    if (is2DUIType(child.type)) {
      sawDom = true;
      return hasNode3DContent(child.children);
    }
    if (nodeComponentRegistry.isCanvasItem(child.type)) {
      sawCanvasItem = true;
      return hasNode3DContent(child.children);
    }
    if (child.instance) {
      const override = instanceOverrideKind(child);
      if (override === '2d') {
        sawCanvasItem = true;
        return false;
      }
      if (override === '3d') return true;
      sawUntypedInstance = true;
      return false;
    }
    // A workspace-neutral container (`Node`, `Timer`, …) may hold either kind,
    // so descend. `Node` is registered with `container: true`, so `get()` alone
    // would read every plain-Node-rooted sub-scene as 3D.
    if (nodeComponentRegistry.isContainer(child.type)) {
      return hasNode3DContent(child.children);
    }
    // A registered non-container type is Node3D content by elimination:
    // CanvasItems and Controls were both matched above.
    if (nodeComponentRegistry.get(child.type)) return true;
    return hasNode3DContent(child.children);
  };

  const found = (kind: ViewportContentKind): ViewportContent => ({
    kind,
    holdsControls: sawDom,
    holdsCanvasItems: sawCanvasItem,
  });
  if (hasNode3DContent(node.children)) return found('3d');
  if (sawCanvasItem) return found('2d');
  // Godot's viewport demos instance 3D sub-scenes, so an untyped instance reads as
  // 3D, but only when nothing decisive was found: anything typed, or an instance
  // whose overrides name a world, outranks it.
  if (sawUntypedInstance) return found('3d');
  // Godot clears a viewport that holds nothing and draws its target (`renderer_viewport.cpp:371`),
  // so the Control pass publishes the bare clear.
  return found('dom');
}

/** The children below `from` (the roots without it) with their instances resolved. */
function resolvedChildren(tree: LiveTree, from?: LiveLink): TscnNode[] {
  return tree.fold<void, TscnNode>(
    undefined,
    ({ raw, step }, _, descend) => {
      if (isViewportBoundary(raw.type)) return raw;
      return { ...step.node, children: descend() };
    },
    from
  );
}

/**
 * The content of the sub-viewport at the link `viewport` of `tree`, classified over its subtree with
 * the instances resolved: a parsed `instance=` child is a childless `Node` whatever its world. The
 * link gives each instance below it its step. A nested sub-viewport is left untouched.
 */
export function viewportContentAt(tree: LiveTree, viewport: LiveLink): ViewportContent {
  const { node } = viewport.step;
  const resolved = { ...node, children: resolvedChildren(tree, viewport) };
  return classify(resolved, embedsAWindow(tree, node, viewport));
}

/**
 * {@link viewportContentAt} for a sub-viewport that no walk of the live tree has visited: it reads
 * a tree of its own children. `node` is the node as shown, so it takes no step of its own. The
 * scope has an empty SubResource pool, because this resolution reads no id.
 */
export function standaloneViewportContent(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sources: LiveTreeSources
): ViewportContent {
  const ctx: LiveTreeContext = { externalResources, internalResources: [], ...sources };
  const tree = liveTreeOf(node.children, ctx);
  return classify({ ...node, children: resolvedChildren(tree) }, embedsAWindow(tree, node));
}
