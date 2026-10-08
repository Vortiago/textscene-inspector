/**
 * The lights one canvas item takes, as Godot lists them per item (`renderer_canvas_render_rd.cpp:
 * 2366-2385`). Items with the same list read the same accumulation buffer, which applies every
 * light on the list in Godot's order, so blends that do not commute (MIX) stay exact.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { MAX_LIGHTS_PER_ITEM } from '../../godot/rendering.js';
import { lightReachesItem, type LightCullKey } from './lightCullKey.js';
import { rect2Intersects, type Rect2 } from '../../godot/rect2.js';

/** What a light tells the pass about itself. */
export interface CanvasLightDeclaration {
  /** Which items the light reaches (`lightCullKey`). */
  readonly reach: LightCullKey;
  /**
   * The light's place in the positional list, its tree order. Null for a directional light, which
   * sits on a list of its own that the per-item cap does not count.
   */
  readonly sequence: number | null;
  /**
   * `Light2D.shadow_item_cull_mask` while a positional light casts a shadow, else null. A
   * directional light's shadow reaches every item, so it declares null.
   */
  readonly shadowItemCullMask: number | null;
  /** Whether the light adds a `shadow_color` where it is blocked. */
  readonly tintsShadow: boolean;
}

/** Where an item sits for the cull test: its `light_mask`, `z_final` and canvas layer. */
export interface ItemPlacement {
  readonly lightMask: number;
  readonly z: number;
  readonly layer: number;
  /**
   * The ordinals of the positional lights on the item's list (`itemPositionalLights`) while more
   * than 15 meet its rect. Null while they fit: the item then reads its placement's list.
   */
  readonly positionalLights: readonly number[] | null;
}

/** The positional lights an item takes, `renderer_canvas_render_rd.cpp:2380`. */
export const MAX_POSITIONAL_LIGHTS_PER_ITEM = MAX_LIGHTS_PER_ITEM - 1;

/**
 * The positional lights that pass the cull test at `item`, in list order: sequence, then ordinal.
 * More than `MAX_POSITIONAL_LIGHTS_PER_ITEM` crowds the placement, so each item's rect picks.
 */
export function positionalCandidates(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  item: ItemPlacement
): number[] {
  const candidates: { ordinal: number; sequence: number }[] = [];
  for (const [ordinal, light] of lights) {
    if (light.sequence === null) continue;
    if (!lightReachesItem(light.reach, item.lightMask, item.z, item.layer)) continue;
    candidates.push({ ordinal, sequence: light.sequence });
  }
  candidates.sort((a, b) => a.sequence - b.sequence || a.ordinal - b.ordinal);
  return candidates.map((candidate) => candidate.ordinal);
}

/**
 * Godot's per-item loop (`renderer_canvas_render_rd.cpp:2366-2385`) takes the first 15 of an item's
 * `positionalCandidates` whose rect meets the item's. A light that misses adds nothing at the
 * item's pixels, so the list keeps it and drops only the lights that meet the item past the 15th:
 * items then share lists. Null while none drops, for the placement's own list. A light with no
 * rect in `lightRects` draws nothing, so it meets no item.
 */
export function itemPositionalLights(
  candidates: readonly number[],
  itemRect: Rect2,
  lightRects: ReadonlyMap<number, Rect2>
): number[] | null {
  const meeting = candidates.filter((ordinal) => {
    const lightRect = lightRects.get(ordinal);
    return lightRect !== undefined && rect2Intersects(itemRect, lightRect);
  });
  if (meeting.length <= MAX_POSITIONAL_LIGHTS_PER_ITEM) return null;
  const dropped = new Set(meeting.slice(MAX_POSITIONAL_LIGHTS_PER_ITEM));
  return candidates.filter((ordinal) => !dropped.has(ordinal));
}

/** One light on an item's list. */
export interface LightListEntry {
  /** The light's ordinal on the canvas (`register`). */
  readonly ordinal: number;
  /**
   * True where the light casts but the item's `light_mask` misses its `shadow_item_cull_mask`:
   * `canvas.glsl:806` then applies the light without its shadow.
   */
  readonly unshadowed: boolean;
}

/** Whether `light` is on `item`'s list: it passes the cull test and, if capped, the item takes it. */
function itemTakesLight(light: CanvasLightDeclaration, ordinal: number, item: ItemPlacement): boolean {
  if (!lightReachesItem(light.reach, item.lightMask, item.z, item.layer)) return false;
  return light.sequence === null || item.positionalLights === null || item.positionalLights.includes(ordinal);
}

/** The lights on `item`'s list, in ordinal order. */
export function itemLightList(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  item: ItemPlacement
): LightListEntry[] {
  const list: LightListEntry[] = [];
  for (const [ordinal, light] of lights) {
    if (!itemTakesLight(light, ordinal, item)) continue;
    const shadowMask = light.shadowItemCullMask;
    list.push({ ordinal, unshadowed: shadowMask !== null && (shadowMask & item.lightMask) === 0 });
  }
  return list.sort((a, b) => a.ordinal - b.ordinal);
}

/** A canonical string for a list, so two items with the same list share a buffer. */
export function lightListId(list: readonly LightListEntry[]): string {
  return list.map((entry) => `${entry.ordinal}${entry.unshadowed ? 'u' : 's'}`).join(',');
}

/** A string for a placement, for use as a Map key. */
export function placementId(item: ItemPlacement): string {
  const positional = item.positionalLights?.join(',') ?? '*';
  return `${item.lightMask}|${item.z}|${item.layer}|${positional}`;
}

/** One placement the canvas holds a lit item at, and whether a Light Only item sits there. */
export interface PlacementDeclarations {
  readonly placement: ItemPlacement;
  readonly hasLightOnly: boolean;
}

/** One list the pass accumulates, and the placements that read it. */
export interface LightListPlan {
  /** `lightListId` of the entries. */
  readonly id: string;
  readonly entries: readonly LightListEntry[];
  readonly placementIds: readonly string[];
  /** Whether a Light Only item reads the list, so it needs the unmodulated buffer. */
  readonly hasLightOnly: boolean;
  /** Whether a light that tints its shadow shadows the list, so it needs the `shadow_color` buffer. */
  readonly tintsShadow: boolean;
}

/** The lists the canvas's lit placements take, one plan per distinct list, empty lists left out. */
export function planLightLists(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placements: ReadonlyMap<string, PlacementDeclarations>
): LightListPlan[] {
  const plans = new Map<string, LightListPlan & { placementIds: string[] }>();
  for (const [id, { placement, hasLightOnly }] of placements) {
    const entries = itemLightList(lights, placement);
    if (entries.length === 0) continue;
    const listId = lightListId(entries);
    const plan = plans.get(listId) ?? {
      id: listId,
      entries,
      placementIds: [],
      hasLightOnly: false,
      tintsShadow: entries.some((entry) => !entry.unshadowed && lights.get(entry.ordinal)!.tintsShadow),
    };
    plan.placementIds.push(id);
    plans.set(listId, { ...plan, hasLightOnly: plan.hasLightOnly || hasLightOnly });
  }
  return [...plans.values()];
}

/**
 * What a light mesh is to the pass. A light's `volume` stencil and `lit` quad draw its authored
 * shadow, `tint` adds its `shadow_color`, and `unshadowed` is its quad without the shadow. Each
 * light writes both buffers over its whole reach with one alpha, so a MIX light scales both: `shade`
 * carries the tint's alpha into the light pass, and `fade` and `unshadowedFade` the lit alpha into
 * the tint pass.
 */
export type PassMeshRole = 'volume' | 'lit' | 'shade' | 'tint' | 'fade' | 'unshadowed' | 'unshadowedFade';

/** `light` accumulates `S`, from either seed. `tint` accumulates the albedo-free `shadow_color`. */
export type PassKind = 'light' | 'tint';

/** The entry a role draws for, by its `unshadowed` flag, and the passes it draws in. */
const ROLE_PASSES: Readonly<Record<PassMeshRole, { unshadowed: boolean; kinds: readonly PassKind[] }>> = {
  volume: { unshadowed: false, kinds: ['light', 'tint'] },
  lit: { unshadowed: false, kinds: ['light'] },
  shade: { unshadowed: false, kinds: ['light'] },
  tint: { unshadowed: false, kinds: ['tint'] },
  fade: { unshadowed: false, kinds: ['tint'] },
  unshadowed: { unshadowed: true, kinds: ['light'] },
  unshadowedFade: { unshadowed: true, kinds: ['tint'] },
};

/** Whether a light's mesh of `role` draws in a `kind` pass over a list holding `entry`. */
export function drawsInPass(entry: LightListEntry | undefined, role: PassMeshRole, kind: PassKind): boolean {
  if (entry === undefined) return false;
  const passes = ROLE_PASSES[role];
  return passes.unshadowed === entry.unshadowed && passes.kinds.includes(kind);
}
