/**
 * A light's place in its canvas light list, its draw order: Godot applies lights in attach order
 * (`renderer_canvas_cull.cpp:2102`, `renderer_viewport.cpp:450-473`), the preorder walk, and MIX
 * depends on the order. The stencil ordinal cannot serve, as it follows
 * cookie load order and is reused on unmount. The walk reads the live tree, since
 * `YSortDispatcher` mounts in sort order and Godot ranks by tree position.
 */

import type { TscnNode } from '../../parser/types.js';
import { MAX_2D_DIRECTIONAL_LIGHTS } from '../../godot/rendering/rendering.js';
import { isViewportBoundary } from '../../nodes/viewport/subviewport/viewportBoundary.js';
import type { LiveTree } from '../liveSceneTree.js';

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

/** The paths of the lights one canvas lists, each list in draw order. */
export interface CanvasLightPaths {
  readonly positional: readonly string[];
  /** At most `MAX_2D_DIRECTIONAL_LIGHTS` (`renderer_viewport.cpp:511`). */
  readonly directional: readonly string[];
}

/** The canvas a node sits in, and whether a hidden ancestor of that canvas hides it. */
interface CanvasScope {
  readonly viewportPath: string | null;
  readonly isHidden: boolean;
}

const ROOT_CANVAS: CanvasScope = { viewportPath: null, isHidden: false };

/**
 * The light lists of every canvas, keyed by the path of the SubViewport that owns it (null: the
 * root canvas). Each SubViewport has a World2D of its own (`viewport.cpp:5345`), so a light belongs
 * to the nearest SubViewport above it, and the lists run in preorder.
 *
 * A hidden ancestor unlists a directional light up to the SubViewport below it: a CanvasItem under
 * a SubViewport takes its parent as visible (`canvas_item.cpp:309-349`).
 */
export function lightPathsByCanvas(tree: LiveTree): ReadonlyMap<string | null, CanvasLightPaths> {
  const lists = new Map<string | null, { positional: string[]; directional: string[] }>();
  const listsOf = (viewportPath: string | null) => {
    let list = lists.get(viewportPath);
    if (!list) lists.set(viewportPath, (list = { positional: [], directional: [] }));
    return list;
  };

  tree.fold<CanvasScope, void>(ROOT_CANVAS, ({ step, path }, canvas, descend) => {
    const { node } = step;
    const list = listsOf(canvas.viewportPath);
    if (isPositionalCanvasLight(node)) list.positional.push(path);
    if (isListedDirectionalLight(node) && !canvas.isHidden) list.directional.push(path);
    if (isViewportBoundary(node.type)) descend({ viewportPath: path, isHidden: false });
    else descend(isShownCanvasNode(node) ? canvas : { ...canvas, isHidden: true });
  });
  for (const list of lists.values()) list.directional.splice(MAX_2D_DIRECTIONAL_LIGHTS);
  return lists;
}

/**
 * Where an unlisted light ranks: after every listed light, so the cap and the draw agree when
 * listed and unlisted lights mix. A canvas holds far fewer than 2^20 lights.
 */
const UNLISTED_LIGHT_SEQUENCE = 2 ** 20;

/**
 * The sequence a light draws at: its `listed` place, else after every listed light by `ordinal`. A
 * light declares before it has an ordinal, so unlisted lights tie there, and the cap breaks the tie
 * by ordinal, which is the order the draw uses.
 */
export function lightDrawSequence(listed: number | null, ordinal: number | null): number {
  return listed ?? UNLISTED_LIGHT_SEQUENCE + (ordinal ?? 0);
}
