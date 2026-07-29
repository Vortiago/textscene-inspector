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
 * Nested sub-viewports are not descended into: their subtree draws into THEIR
 * target, which is where `Viewport` rasterisation stops.
 */
export function viewportContentKind(node: TscnNode): ViewportContentKind {
  let sawCanvasItem = false;
  let sawDom = false;

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
      // An instance node has no type until its sub-scene resolves. Godot's own
      // viewport demos instance 3D sub-scenes, so treat it as 3D content and
      // let a Control sub-scene be the documented miss.
      if (child.instance) return true;
      // A registered 3D node, or a plain container — descend through the
      // container, since a bare `Node` may hold either kind.
      if (nodeComponentRegistry.get(child.type)) return true;
      return hasNode3DContent(child.children);
    });

  if (hasNode3DContent(node.children)) return '3d';
  if (sawCanvasItem) return '2d';
  return sawDom ? 'dom' : 'empty';
}
