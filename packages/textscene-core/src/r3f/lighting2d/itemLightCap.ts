/**
 * Godot's 15-light cap on each item, run once a frame ahead of the light pass. Only an item on a
 * placement more than 15 positional lights reach is measured, and it re-renders only when its
 * list changes.
 */

import * as THREE from 'three';
import { computeWorldBoundingBox } from '../bounds.js';
import {
  itemPositionalLights,
  MAX_POSITIONAL_LIGHTS_PER_ITEM,
  placementId,
  positionalCandidates,
  type CanvasLightDeclaration,
  type ItemPlacement,
} from './itemLightList.js';
import type { PassMesh } from './lightAccumulationPass.js';
import { rect2Intersects, rect2Merge, type Rect2 } from '../../godot/rect2.js';

/** A lit item as the cap sees it. */
export interface CappedItem {
  /** The item's cull placement, uncapped. */
  readonly placement: ItemPlacement;
  /** The item's own geometry, its child items left out, or null before it mounts. */
  readonly geometry: { readonly current: THREE.Object3D | null };
  /** Hands the item its positional light list (`itemPositionalLights`), or null for its placement's. */
  take(positionalLights: readonly number[] | null): void;
}

export interface ItemLightCap {
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
  /** Whether more positional lights are declared than an item takes, so any placement can crowd. */
  readonly canCrowd: boolean;
  /** The candidates at each placement, by `placementId`, or null where they all fit. */
  readonly candidates: Map<string, readonly number[] | null>;
}

/** Written only by `crowdingOf`. An entry clears when its `lights` state is collected. */
const crowdingByLights = new WeakMap<ReadonlyMap<number, CanvasLightDeclaration>, Crowding>();

function crowdingOf(lights: ReadonlyMap<number, CanvasLightDeclaration>): Crowding {
  let crowding = crowdingByLights.get(lights);
  if (!crowding) {
    const positional = [...lights.values()].filter((light) => light.sequence !== null).length;
    crowding = { canCrowd: positional > MAX_POSITIONAL_LIGHTS_PER_ITEM, candidates: new Map() };
    crowdingByLights.set(lights, crowding);
  }
  return crowding;
}

/** The candidates at `placement` while they crowd it, else null. */
function crowdedCandidates(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  crowding: Crowding,
  placement: ItemPlacement
): readonly number[] | null {
  const id = placementId(placement);
  let candidates = crowding.candidates.get(id);
  if (candidates === undefined) {
    const all = positionalCandidates(lights, placement);
    candidates = all.length > MAX_POSITIONAL_LIGHTS_PER_ITEM ? all : null;
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

function sameLights(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((ordinal, index) => ordinal === b[index]);
}

/** Hands each item its positional light list this frame, where it changed, and records its window. */
export function capItemLights({ lights, items, passMeshes, viewport, windows }: ItemLightCap): void {
  const crowding = crowdingOf(lights);
  let rects: Map<number, Rect2> | null = null;
  windows.clear();
  for (const [item, handed] of items) {
    const candidates = crowding.canCrowd ? crowdedCandidates(lights, crowding, item.placement) : null;
    let list: readonly number[] | null = null;
    if (candidates) {
      rects ??= lightRects(passMeshes, viewport);
      const itemRect = worldRect(item.geometry.current);
      list = itemPositionalLights(candidates, itemRect, rects);
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
