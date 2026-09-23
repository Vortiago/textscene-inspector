/**
 * The kind of content a sub-viewport holds, which decides its one publisher: the
 * 3D/2D offscreen pass owns `'3d'` and `'2d'`, `ControlRasterPass.tsx` owns `'dom'`,
 * and nothing publishes `'empty'`. Both write the same `ViewportTextureRegistry`
 * key, so the split is decided here alone.
 */

import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import { is2DUIType } from '../../../r3f/controls/has2DUIContent.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';
import {
  liveChildGroups,
  type CachedSceneSource,
  type SceneScope,
} from '../../../r3f/liveSceneTree.js';
import { compositeCallPrefix } from '../../../godot/index.js';

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
  /** Controls only, drawn by the native Control-raster pass (`ControlRasterPass.tsx`). */
  | 'dom'
  | 'empty';

/**
 * Classify a sub-viewport's subtree. Precedence is 3D > 2D > DOM, and one kind is
 * drawn where Godot composites all (`comparison.md`). A nested sub-viewport draws
 * into its own target, so it is not descended into.
 */
export function viewportContentKind(node: TscnNode): ViewportContentKind {
  let sawCanvasItem = false;
  let sawDom = false;
  let sawUntypedInstance = false;

  const hasNode3DContent = (nodes: readonly TscnNode[]): boolean =>
    nodes.some((child) => {
      if (child.type === 'SubViewport') return false;
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
    });

  if (hasNode3DContent(node.children)) return '3d';
  if (sawCanvasItem) return '2d';
  // Godot's viewport demos instance 3D sub-scenes, so an untyped instance reads as
  // 3D, but only when nothing decisive was found: anything typed, or an instance
  // whose overrides name a world, outranks it.
  if (sawUntypedInstance) return '3d';
  return sawDom ? 'dom' : 'empty';
}

/**
 * How deep the resolver follows instances-of-instances. Godot itself has no
 * limit. This one exists so a cyclic sub-scene reference (a scene the parser
 * accepts and Godot rejects at import) cannot hang the render.
 */
const MAX_RESOLVE_DEPTH = 32;

/**
 * The sub-viewport's subtree with its instances resolved, the input
 * `viewportContentKind` wants: a parsed `instance=` child is a childless `Node`
 * whatever its world. `liveChildGroups` gives each group the ExtResource scope its
 * own instance refs resolve against. A nested sub-viewport is returned untouched.
 */
export function resolveViewportSubtree(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource
): TscnNode {
  const resolve = (
    child: TscnNode,
    scope: SceneScope,
    depth: number
  ): TscnNode => {
    if (depth >= MAX_RESOLVE_DEPTH || child.type === 'SubViewport') return child;
    const groups = liveChildGroups(child, scope, sceneCache);
    // A collapsed single-root instance (ADR-0013) becomes its sub-scene root.
    // Every other origin leaves the node's own identity alone.
    const effective = groups.find((group) => group.origin === 'merged')?.mergedNode ?? child;
    const children = groups.flatMap((group) =>
      group.children.map((grandchild) => resolve(grandchild, group.scope, depth + 1))
    );
    return { ...effective, children };
  };

  return {
    ...node,
    // This resolution reads no SubResource id, so it declares an empty pool
    // rather than carry one. `SceneScope` says why the two travel together.
    children: node.children.map((child) =>
      resolve(child, { externalResources, internalResources: [] }, 0)
    ),
  };
}
