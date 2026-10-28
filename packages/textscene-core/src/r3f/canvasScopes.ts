/**
 * What each canvas of a live tree holds, from one walk: the light lists of every SubViewport, and
 * the CanvasModulate of the canvas the walk starts in. Godot keeps lights per viewport and
 * CanvasModulate per canvas, so one walk answers both with one rule each.
 */

import type { TscnNode } from '../parser/types.js';
import { MAX_2D_DIRECTIONAL_LIGHTS } from '../godot/rendering/rendering.js';
import { isViewportBoundary } from '../nodes/viewport/subviewport/viewportBoundary.js';
import type { Rgba } from '../godot/math/math.js';
import { perObject } from '../utils/perObject.js';
import type { LiveTree } from './liveSceneTree.js';

/**
 * Canvas lights that take a slot in the positional list. A `DirectionalLight2D` sits on a list of
 * its own (`renderer_viewport.cpp:491-514`), applied ahead of every positional light.
 */
const POSITIONAL_LIGHT_TYPES = new Set(['PointLight2D']);

/** True for a node that occupies a slot in the positional canvas light list. */
function isPositionalCanvasLight(node: TscnNode): boolean {
  return POSITIONAL_LIGHT_TYPES.has(node.type);
}

/** Whether a node is shown, reading the parsed `visible` a CanvasItem parser leaves unset by default. */
function isShownCanvasNode(node: TscnNode): boolean {
  return (node.properties as { visible?: boolean }).visible !== false;
}

/**
 * True for a DirectionalLight2D that reaches the directional list. `Light2D::_update_light_visibility`
 * (`light_2d.cpp:59`) enables the light only while it is `enabled` and visible in the tree, and the
 * viewport lists only enabled lights, so a disabled or hidden light takes no slot.
 */
function isListedDirectionalLight(node: TscnNode): boolean {
  return (
    node.type === 'DirectionalLight2D' &&
    (node.properties as { enabled?: boolean }).enabled !== false &&
    isShownCanvasNode(node)
  );
}

/** The paths of the lights one viewport lists, each list in draw order. */
export interface CanvasLightPaths {
  readonly positional: readonly string[];
  /** At most `MAX_2D_DIRECTIONAL_LIGHTS` (`renderer_viewport.cpp:511`). */
  readonly directional: readonly string[];
}

export interface CanvasScopes {
  /**
   * The light lists by the path of the SubViewport that owns them (null: the walk's own viewport).
   * Each SubViewport has a World2D (`viewport.cpp:5345`), and the viewport gathers the lights of
   * every canvas in it, its CanvasLayers included (`renderer_viewport.cpp:443-466`).
   */
  readonly lights: ReadonlyMap<string | null, CanvasLightPaths>;
  /**
   * The colour of the last visible CanvasModulate in the walk's own canvas, null without one. A
   * CanvasModulate joins the group of `get_canvas()` (`canvas_modulate.cpp:33-34`), and a CanvasLayer
   * has a canvas of its own (`canvas_item.cpp:1131-1139`), so a viewport's other canvases keep theirs.
   */
  readonly modulate: Rgba | null;
}

/** Where a node sits relative to the walk's own canvas. */
interface CanvasScope {
  readonly viewportPath: string | null;
  /**
   * A hidden ancestor, up to the SubViewport below it: a CanvasItem under a SubViewport takes its
   * parent as visible (`canvas_item.cpp:309-349`).
   */
  readonly isHidden: boolean;
  /** Below a CanvasLayer, whose CanvasModulate tints the layer's canvas alone. */
  readonly isInLayer: boolean;
}

const OWN_CANVAS: CanvasScope = { viewportPath: null, isHidden: false, isInLayer: false };

function scopesOfCanvases(tree: LiveTree): CanvasScopes {
  const lists = new Map<string | null, { positional: string[]; directional: string[] }>();
  const listsOf = (viewportPath: string | null) => {
    let list = lists.get(viewportPath);
    if (!list) lists.set(viewportPath, (list = { positional: [], directional: [] }));
    return list;
  };
  let modulate: Rgba | null = null;

  tree.fold<CanvasScope, void>(OWN_CANVAS, ({ step, path }, scope, descend) => {
    const { node } = step;
    const list = listsOf(scope.viewportPath);
    if (isPositionalCanvasLight(node)) list.positional.push(path);
    if (isListedDirectionalLight(node) && !scope.isHidden) list.directional.push(path);
    const { color } = node.properties as { color?: Rgba };
    if (
      node.type === 'CanvasModulate' &&
      color &&
      scope.viewportPath === null &&
      !scope.isInLayer &&
      !scope.isHidden &&
      isShownCanvasNode(node)
    ) {
      modulate = color;
    }

    if (isViewportBoundary(node.type)) {
      descend({ viewportPath: path, isHidden: false, isInLayer: false });
      return;
    }
    const inherited = isShownCanvasNode(node) ? scope : { ...scope, isHidden: true };
    descend(node.type === 'CanvasLayer' ? { ...inherited, isInLayer: true } : inherited);
  });
  for (const list of lists.values()) list.directional.splice(MAX_2D_DIRECTIONAL_LIGHTS);
  return { lights: lists, modulate };
}

/**
 * The scopes of `tree`, in preorder. Every reader of one tree shares the walk, so a light's slot and
 * a canvas's tint cost one pass between them.
 *
 * @canonical What each canvas of a live tree holds: its light lists and its CanvasModulate
 */
export const canvasScopesOf = perObject(scopesOfCanvases);
