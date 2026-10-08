/**
 * Godot's 15-light cap on each item, run once a frame ahead of the light pass. Only an item on a
 * placement more than 15 positional lights reach is measured, and it re-renders only when the
 * lights it takes change.
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
import type { LightRect } from './shadowVolumes.js';

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
  /** Each registered item, with the positional lights it was last handed, null until crowded. */
  readonly items: Map<CappedItem, readonly number[] | null>;
  readonly passMeshes: ReadonlySet<PassMesh>;
}

/** What one `lights` state crowds. The state is immutable, so a new one builds a new entry. */
interface Crowding {
  /** Whether more positional lights are declared than an item takes, so any placement can crowd. */
  readonly canCrowd: boolean;
  /** The candidates at each placement, by `placementId`, or null where they all fit. */
  readonly candidates: Map<string, readonly number[] | null>;
}

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

const box = new THREE.Box3();

/** The world rect of `object`'s geometry. An empty one is inverted, as an empty `Box3` is, and meets none. */
function worldRect(object: THREE.Object3D | null): LightRect {
  if (object) computeWorldBoundingBox(object, box);
  else box.makeEmpty();
  return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y };
}

function union(a: LightRect, b: LightRect): LightRect {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Each light's rect, `Light2D`'s `rect_cache`: where its quads land. */
function lightRects(passMeshes: ReadonlySet<PassMesh>): Map<number, LightRect> {
  const rects = new Map<number, LightRect>();
  for (const { mesh, ordinal, role } of passMeshes) {
    if (!REACH_ROLES.has(role)) continue;
    const rect = worldRect(mesh);
    const previous = rects.get(ordinal);
    rects.set(ordinal, previous ? union(previous, rect) : rect);
  }
  return rects;
}

function sameLights(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((ordinal, index) => ordinal === b[index]);
}

/** Hands each item the positional lights it takes this frame, where they changed. */
export function capItemLights({ lights, items, passMeshes }: ItemLightCap): void {
  const crowding = crowdingOf(lights);
  let rects: Map<number, LightRect> | null = null;
  for (const [item, handed] of items) {
    const candidates = crowding.canCrowd ? crowdedCandidates(lights, crowding, item.placement) : null;
    let taken: readonly number[] | null = null;
    if (candidates) {
      rects ??= lightRects(passMeshes);
      taken = itemPositionalLights(candidates, worldRect(item.geometry.current), rects);
    }
    if (sameLights(taken, handed)) continue;
    items.set(item, taken);
    item.take(taken);
  }
}
