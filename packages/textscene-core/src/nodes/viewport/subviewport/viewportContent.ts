/**
 * What kind of content a sub-viewport holds — the seam that decides HOW its
 * target is produced.
 *
 * A Godot viewport rasterises its 3D world and its 2D canvas into one target.
 * The previewer cannot: its renderer draws one workspace at a time, and
 * Controls are DOM (ADR-0003) rather than WebGL, so a Control-only sub-viewport
 * has no WebGL source at all and its pixels come from a DOM rasterizer instead.
 * Both rasterizers publish into the same `ViewportTextureRegistry`, so the
 * split has to be decided in ONE place — here — or they race for the same key.
 *
 * The offscreen (WebGL) publisher owns `'3d'` and `'2d'`; the DOM rasterizer
 * owns `'dom'`; nobody publishes for `'empty'`.
 */

import type { TscnNode } from '../../../parser/types';
import { TWO_D_UI_TYPES } from '../../../r3f/controls/has2DUIContent.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';

/**
 * CanvasItem-only property names. Each exists on `CanvasItem` or `Node2D` and
 * on no Node3D class, so finding one among an instance node's own overrides
 * names the world its sub-scene belongs to before the sub-scene has loaded.
 * (`modulate`/`self_modulate`/`show_behind_parent`/`clip_children`/
 * `texture_*`/`light_mask` are `CanvasItem`'s; `z_index`/`z_as_relative`/
 * `y_sort_enabled`/`skew` are `Node2D`'s.)
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
 * Which world an INSTANCE node's own overrides name, or null when they name
 * neither.
 *
 * A `.tscn` records an instance's overrides verbatim against the base class
 * they belong to, and the parser keeps them in `rawProperties` precisely
 * because the node has no type until its sub-scene resolves. The constructor
 * in a transform value is decisive on its own: `position = Vector2(…)` cannot
 * be a Node3D and `Transform3D(…)` cannot be a CanvasItem.
 */
function instanceOverrideKind(node: TscnNode): '2d' | '3d' | null {
  const raw = node.rawProperties;
  if (!raw) return null;
  for (const [key, value] of Object.entries(raw)) {
    if (CANVAS_ITEM_ONLY_PROPERTIES.has(key)) return '2d';
    if (/^\s*(Vector2|Transform2D|Rect2)\s*\(/.test(value)) return '2d';
    if (/^\s*(Vector3|Transform3D|Basis|Quaternion|AABB)\s*\(/.test(value)) return '3d';
  }
  return null;
}

export type ViewportContentKind =
  /** Node3D content — rendered through a `Camera3D` descendant. */
  | '3d'
  /** 2D-world (CanvasItem, non-Control) content — rendered through an ortho camera framing the target. */
  | '2d'
  /** Controls only — rasterized from the DOM overlay, not by this subsystem. */
  | 'dom'
  /** Nothing to draw. */
  | 'empty';

/**
 * Classify a sub-viewport's subtree.
 *
 * Precedence is 3D > 2D > DOM: a viewport mixing kinds still gets a target
 * showing its 3D half, which beats one showing nothing. Only one kind is drawn
 * — a divergence from Godot, which composites all of them, and the reason
 * mixed-content viewports are called out in `comparison.md`.
 *
 * An unresolved instance is the one claim that is SPECULATIVE rather than
 * decisive. It has no type until its sub-scene loads, and Godot's own viewport
 * demos instance 3D sub-scenes, so a bare one is still read as 3D — but only
 * once nothing decisive has been found, so a positioned 2D sibling settles the
 * viewport for an untouched instance next to it. Anything with a type, and any
 * instance whose own overrides name a world, outranks it.
 *
 * Nested sub-viewports are not descended into: their subtree draws into THEIR
 * target, which is where `Viewport` rasterisation stops.
 */
export function viewportContentKind(node: TscnNode): ViewportContentKind {
  let sawCanvasItem = false;
  let sawDom = false;
  let sawUntypedInstance = false;

  const hasNode3DContent = (nodes: readonly TscnNode[]): boolean =>
    nodes.some((child) => {
      if (child.type === 'SubViewport') return false;
      if (TWO_D_UI_TYPES.has(child.type)) {
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
      // A registered 3D node, or a plain container — descend through the
      // container, since a bare `Node` may hold either kind.
      if (nodeComponentRegistry.get(child.type)) return true;
      return hasNode3DContent(child.children);
    });

  if (hasNode3DContent(node.children)) return '3d';
  if (sawCanvasItem) return '2d';
  if (sawUntypedInstance) return '3d';
  return sawDom ? 'dom' : 'empty';
}
