/**
 * Godot's 15-light cap on each item and its 256-light budget for a render, run once a frame ahead
 * of the light pass. Only an item on a placement where a light can drop is measured, and it
 * re-renders only when its list changes.
 */

import * as THREE from 'three';
import { computeWorldBoundingBox } from '../bounds.js';
import { MAX_LIGHTS_PER_RENDER } from '../../godot/rendering/rendering.js';
import type { LightCullKey } from './lightCullKey.js';
import {
  directionalListOrder,
  itemPositionalLights,
  MAX_POSITIONAL_LIGHTS_PER_ITEM,
  positionalListOrder,
  placementId,
  positionalCandidates,
  type CanvasLightDeclaration,
  type ItemPlacement,
} from './itemLightList.js';
import type { PassMesh } from './lightAccumulationPass.js';
import { rect2Intersects, rect2Merge, type Rect2 } from '../../godot/math/rect2.js';
import { perObject } from '../../utils/perObject.js';
import { sameElements } from '../../utils/sameElements.js';

/** A lit item as the cap sees it. */
export interface CappedItem {
  /** The item's cull placement, uncapped. */
  readonly placement: ItemPlacement;
  /** The item's own geometry, its child items left out, or null before it mounts. */
  readonly geometry: { readonly current: THREE.Object3D | null };
  /** Hands the item its whole light list (`ItemPlacement.takenLights`), or null for its placement's. */
  take(takenLights: readonly number[] | null): void;
}

interface ItemLightCap {
  readonly lights: ReadonlyMap<number, CanvasLightDeclaration>;
  /** Each registered item, with the light list it was last handed, null until crowded. */
  readonly items: Map<CappedItem, readonly number[] | null>;
  readonly passMeshes: ReadonlySet<PassMesh>;
  /**
   * The game viewport in the world: Godot lists only the lights that meet it
   * (`renderer_viewport.cpp:470`).
   */
  readonly viewport: Rect2;
  /**
   * Rewritten each frame: the world rect the items of each capped placement cover, by
   * `placementId`, so the pass clips that list's buffer to it (`lightListWindow.ts`).
   */
  readonly windows: Map<string, Rect2>;
}

/** What one `lights` state crowds. The state is immutable, so a new one builds a new entry. */
interface Crowding {
  /** Whether a light can drop: more positional lights than an item takes, or than a render. */
  readonly canDrop: boolean;
  /** Whether the lights declared can fill a render, so a placement of few can still lose one. */
  readonly canExceedBudget: boolean;
  /** The declared positional lights in list order. */
  readonly positionalOrder: readonly number[];
  /** The declared directional lights in list order. */
  readonly directionalOrder: readonly number[];
  /** The candidates at each placement, by `placementId`, or null where they all fit. */
  readonly candidates: Map<string, readonly number[] | null>;
}

/** An entry clears when its `lights` state is collected. */
const crowdingOf = perObject((lights: ReadonlyMap<number, CanvasLightDeclaration>): Crowding => {
  const positionalOrder = positionalListOrder(lights, lights.keys());
  const directionalOrder = directionalListOrder(lights, lights.keys());
  const canExceedBudget = lights.size > MAX_LIGHTS_PER_RENDER;
  return {
    canDrop: canExceedBudget || positionalOrder.length > MAX_POSITIONAL_LIGHTS_PER_ITEM,
    canExceedBudget,
    positionalOrder,
    directionalOrder,
    candidates: new Map(),
  };
});

/** The candidates at `placement` while they crowd it or the budget can drop one, else null. */
function crowdedCandidates(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  crowding: Crowding,
  placement: ItemPlacement
): readonly number[] | null {
  const id = placementId(placement);
  let candidates = crowding.candidates.get(id);
  if (candidates === undefined) {
    const all = positionalCandidates(lights, placement);
    candidates = all.length > MAX_POSITIONAL_LIGHTS_PER_ITEM || crowding.canExceedBudget ? all : null;
    crowding.candidates.set(id, candidates);
  }
  return candidates;
}

/** The roles whose quad covers a light's whole reach. */
const REACH_ROLES = new Set<PassMesh['role']>(['lit', 'unshadowed']);

/** Scratch for `worldRect`, read back into a `Rect2` before the next item writes it. */
const box = new THREE.Box3();

/** A `Box3` as a `Rect2`. An empty box gives an inverted rect, which meets none. */
function boxRect({ min, max }: THREE.Box3): Rect2 {
  return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
}

/** The world rect of `object`'s geometry. */
function worldRect(object: THREE.Object3D | null): Rect2 {
  if (object) computeWorldBoundingBox(object, box);
  else box.makeEmpty();
  return boxRect(box);
}

/**
 * Each listed light's rect, `Light2D`'s `rect_cache`: where its quads land. A light whose rect
 * misses `viewport` is off Godot's list (`renderer_viewport.cpp:390,470`), so it has none here.
 */
function lightRects(passMeshes: ReadonlySet<PassMesh>, viewport: Rect2): Map<number, Rect2> {
  const boxes = new Map<number, THREE.Box3>();
  for (const { mesh, ordinal, role } of passMeshes) {
    if (!REACH_ROLES.has(role)) continue;
    const quad = computeWorldBoundingBox(mesh);
    const previous = boxes.get(ordinal);
    boxes.set(ordinal, previous ? previous.union(quad) : quad);
  }
  const rects = new Map<number, Rect2>();
  for (const [ordinal, lightBox] of boxes) {
    const rect = boxRect(lightBox);
    if (rect2Intersects(rect, viewport)) rects.set(ordinal, rect);
  }
  return rects;
}

const NOTHING_OVER_BUDGET: ReadonlySet<number> = new Set();

function reachesLayer({ layerMin, layerMax }: LightCullKey, layer: number): boolean {
  return layer >= layerMin && layer <= layerMax;
}

/** What one canvas layer lists of the render's budget. */
interface LayerBudget {
  /** The directional lights on the layer's list: the first `MAX_LIGHTS_PER_RENDER` in list order. */
  readonly directional: readonly number[];
  /** Whether the layer reaches more directional lights than the budget lists. */
  readonly dropsDirectional: boolean;
  /** The positional lights past what the directional lights leave of the budget. */
  readonly overBudget: ReadonlySet<number>;
}

/**
 * The budget of the canvas on `layer`. Godot lists the lights in range of the layer
 * (`renderer_viewport.cpp:667-690`), the directional ones first, and drops the listed positional
 * lights whose rect meets the viewport past what they leave (`renderer_canvas_render_rd.cpp:592`).
 */
function layerBudget(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  { positionalOrder, directionalOrder }: Crowding,
  rects: ReadonlyMap<number, Rect2>,
  layer: number
): LayerBudget {
  const reached = (ordinal: number) => reachesLayer(lights.get(ordinal)!.reach, layer);
  const reachedDirectional = directionalOrder.filter(reached);
  const directional = reachedDirectional.slice(0, MAX_LIGHTS_PER_RENDER);
  const dropsDirectional = directional.length < reachedDirectional.length;
  const budget = MAX_LIGHTS_PER_RENDER - directional.length;
  if (rects.size <= budget) return { directional, dropsDirectional, overBudget: NOTHING_OVER_BUDGET };
  const overBudget = new Set<number>();
  let listed = 0;
  for (const ordinal of positionalOrder) {
    if (rects.has(ordinal) && reached(ordinal) && ++listed > budget) overBudget.add(ordinal);
  }
  return { directional, dropsDirectional, overBudget };
}

/** `candidates` without the lights over budget, filtered once per placement a frame. */
function withinBudget(
  candidates: readonly number[],
  overBudget: ReadonlySet<number>,
  filtered: Map<readonly number[], readonly number[]>
): readonly number[] {
  if (overBudget.size === 0) return candidates;
  let taken = filtered.get(candidates);
  if (!taken) {
    const kept = candidates.filter((ordinal) => !overBudget.has(ordinal));
    taken = kept.length === candidates.length ? candidates : kept;
    filtered.set(candidates, taken);
  }
  return taken;
}

function sameLights(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return sameElements(a, b);
}

/** Hands each item its light list this frame, where it changed, and records its window. */
export function capItemLights({ lights, items, passMeshes, viewport, windows }: ItemLightCap): void {
  const crowding = crowdingOf(lights);
  let rects: Map<number, Rect2> | null = null;
  const budgetByLayer = new Map<number, LayerBudget>();
  const filtered = new Map<readonly number[], readonly number[]>();
  const budgetAt = (layer: number, lightRects: ReadonlyMap<number, Rect2>): LayerBudget => {
    let budget = budgetByLayer.get(layer);
    if (!budget) budgetByLayer.set(layer, (budget = layerBudget(lights, crowding, lightRects, layer)));
    return budget;
  };
  windows.clear();
  for (const [item, handed] of items) {
    const candidates = crowding.canDrop ? crowdedCandidates(lights, crowding, item.placement) : null;
    let list: readonly number[] | null = null;
    if (candidates) {
      rects ??= lightRects(passMeshes, viewport);
      const { directional, dropsDirectional, overBudget } = budgetAt(item.placement.layer, rects);
      const taken = withinBudget(candidates, overBudget, filtered);
      const itemRect = worldRect(item.geometry.current);
      const positional =
        itemPositionalLights(taken, itemRect, rects) ??
        (taken === candidates && !dropsDirectional ? null : taken);
      list = positional && [...positional, ...directional];
      if (list) recordWindow(windows, placementId({ ...item.placement, takenLights: list }), itemRect);
    }
    if (sameLights(list, handed)) continue;
    items.set(item, list);
    item.take(list);
  }
}

function recordWindow(windows: Map<string, Rect2>, id: string, itemRect: Rect2): void {
  const window = windows.get(id);
  windows.set(id, window ? rect2Merge(window, itemRect) : itemRect);
}
