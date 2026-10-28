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
  /** Hands the item its positional light list (`itemPositionalLights`), or null for its placement's. */
  take(positionalLights: readonly number[] | null): void;
}

interface ItemLightCap {
  readonly lights: ReadonlyMap<number, CanvasLightDeclaration>;
  /** Each registered item, with the positional lights it was last handed, null until crowded. */
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
  /** The canvas layers each declared directional light is handed to. */
  readonly directionalReaches: readonly LightCullKey[];
  /** The candidates at each placement, by `placementId`, or null where they all fit. */
  readonly candidates: Map<string, readonly number[] | null>;
}

/** An entry clears when its `lights` state is collected. */
const crowdingOf = perObject((lights: ReadonlyMap<number, CanvasLightDeclaration>): Crowding => {
  const positionalOrder = positionalListOrder(lights, lights.keys());
  const directionalReaches = [...lights.values()]
    .filter((light) => light.sequence === null)
    .map((light) => light.reach);
  const canExceedBudget = lights.size > MAX_LIGHTS_PER_RENDER;
  return {
    canDrop: canExceedBudget || positionalOrder.length > MAX_POSITIONAL_LIGHTS_PER_ITEM,
    canExceedBudget,
    positionalOrder,
    directionalReaches,
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

/**
 * The positional lights past the budget of the canvas on `layer`: Godot hands each canvas the lights
 * in range of its layer (`renderer_viewport.cpp:667-690`) and counts the render's lights over that
 * list, the directional ones first. Of the positional lights listed, those whose rect meets the
 * viewport, the ones after what the directional lights leave are dropped (`renderer_canvas_render_rd.cpp:592`).
 */
function overBudgetLights(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  { positionalOrder, directionalReaches }: Crowding,
  rects: ReadonlyMap<number, Rect2>,
  layer: number
): ReadonlySet<number> {
  const directional = directionalReaches.filter((reach) => reachesLayer(reach, layer)).length;
  const budget = Math.max(0, MAX_LIGHTS_PER_RENDER - directional);
  if (rects.size <= budget) return NOTHING_OVER_BUDGET;
  const over = new Set<number>();
  let listed = 0;
  for (const ordinal of positionalOrder) {
    const reaches = reachesLayer(lights.get(ordinal)!.reach, layer);
    if (reaches && rects.has(ordinal) && ++listed > budget) over.add(ordinal);
  }
  return over;
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

/** Hands each item its positional light list this frame, where it changed, and records its window. */
export function capItemLights({ lights, items, passMeshes, viewport, windows }: ItemLightCap): void {
  const crowding = crowdingOf(lights);
  let rects: Map<number, Rect2> | null = null;
  const overBudgetByLayer = new Map<number, ReadonlySet<number>>();
  const filtered = new Map<readonly number[], readonly number[]>();
  const overBudgetAt = (layer: number, lightRects: ReadonlyMap<number, Rect2>): ReadonlySet<number> => {
    if (!crowding.canExceedBudget) return NOTHING_OVER_BUDGET;
    let over = overBudgetByLayer.get(layer);
    if (!over) overBudgetByLayer.set(layer, (over = overBudgetLights(lights, crowding, lightRects, layer)));
    return over;
  };
  windows.clear();
  for (const [item, handed] of items) {
    const candidates = crowding.canDrop ? crowdedCandidates(lights, crowding, item.placement) : null;
    let list: readonly number[] | null = null;
    if (candidates) {
      rects ??= lightRects(passMeshes, viewport);
      const overBudget = overBudgetAt(item.placement.layer, rects);
      const taken = withinBudget(candidates, overBudget, filtered);
      const itemRect = worldRect(item.geometry.current);
      list = itemPositionalLights(taken, itemRect, rects) ?? (taken === candidates ? null : taken);
      if (list) recordWindow(windows, placementId({ ...item.placement, positionalLights: list }), itemRect);
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
