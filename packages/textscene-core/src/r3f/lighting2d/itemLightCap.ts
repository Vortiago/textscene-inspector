/**
 * Godot's 15-light cap on each item, run once a frame ahead of the light pass. Only an item whose
 * placement `crowdsItems` is measured, and it re-renders only when the lights it takes change.
 */

import * as THREE from 'three';
import { computeWorldBoundingBox } from '../bounds.js';
import {
  crowdsItems,
  itemPositionalLights,
  placementId,
  type CanvasLightDeclaration,
  type CanvasRect,
  type ItemPlacement,
} from './itemLightList.js';
import type { PassMesh } from './lightAccumulationPass.js';

/** A lit item as the cap sees it. */
export interface CappedItem {
  /** The item's cull placement, uncapped. */
  readonly placement: ItemPlacement;
  /** The item's own geometry, its child items left out, or null before it mounts. */
  readonly geometry: { readonly current: THREE.Object3D | null };
  /** Hands the item the positional lights it takes, or null once its placement fits them all. */
  take(positionalLights: readonly number[] | null): void;
}

export interface ItemLightCap {
  readonly lights: ReadonlyMap<number, CanvasLightDeclaration>;
  readonly items: ReadonlySet<CappedItem>;
  readonly passMeshes: ReadonlySet<PassMesh>;
  /** What each item was last handed. An item absent from it holds null. */
  readonly handed: WeakMap<CappedItem, readonly number[] | null>;
}

/** The roles whose quad covers a light's whole reach. */
const REACH_ROLES = new Set<PassMesh['role']>(['lit', 'unshadowed']);

const box = new THREE.Box3();

/** The world rect of `object`'s geometry. An empty one meets no rect. */
function worldRect(object: THREE.Object3D): CanvasRect {
  computeWorldBoundingBox(object, box);
  return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y };
}

function union(a: CanvasRect, b: CanvasRect): CanvasRect {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Each light's rect, `Light2D`'s `rect_cache`: where its quad lands. */
function lightRects(passMeshes: ReadonlySet<PassMesh>): Map<number, CanvasRect> {
  const rects = new Map<number, CanvasRect>();
  for (const { mesh, ordinal, role } of passMeshes) {
    if (!REACH_ROLES.has(role)) continue;
    const rect = worldRect(mesh);
    const previous = rects.get(ordinal);
    rects.set(ordinal, previous ? union(previous, rect) : rect);
  }
  return rects;
}

/** The rect of an item with no geometry mounted, inverted as an empty `Box3` is, so it meets none. */
const NO_RECT: CanvasRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

function sameLights(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((ordinal, index) => ordinal === b[index]);
}

/** Hands each item the positional lights it takes this frame, where they changed. */
export function capItemLights({ lights, items, passMeshes, handed }: ItemLightCap): void {
  const crowded = new Map<string, boolean>();
  let rects: Map<number, CanvasRect> | null = null;
  for (const item of items) {
    const id = placementId(item.placement);
    if (!crowded.has(id)) crowded.set(id, crowdsItems(lights, item.placement));
    let taken: readonly number[] | null = null;
    if (crowded.get(id)) {
      rects ??= lightRects(passMeshes);
      const geometry = item.geometry.current;
      taken = itemPositionalLights(lights, item.placement, geometry ? worldRect(geometry) : NO_RECT, rects);
    }
    if (sameLights(taken, handed.get(item) ?? null)) continue;
    handed.set(item, taken);
    item.take(taken);
  }
}
