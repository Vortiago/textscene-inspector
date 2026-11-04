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

import { MAX_LIGHTS_PER_ITEM } from '../../godot/rendering/rendering.js';
import { lightReachesItem, type LightCullKey } from './lightCullKey.js';
import { rect2Intersects, type Rect2 } from '../../godot/math/rect2.js';
import { perObject } from '../../utils/perObject.js';

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
   * A directional light's place in the directional list, its draw order. Absent for a positional
   * light. A directional light without one ranks first, ahead of the lights that have one.
   */
  readonly slot?: number;
  /**
   * `Light2D.shadow_item_cull_mask` while a positional light casts a shadow, else null. A
   * directional light's shadow reaches every item, so it declares null.
   */
  readonly shadowItemCullMask: number | null;
  /** Whether the light adds a `shadow_color` where it is blocked. */
  readonly tintsShadow: boolean;
  /** Whether the light blends by MIX, which a normal-mapped item reads to shade it. */
  readonly mixes: boolean;
}

/** Where an item sits for the cull test: its `light_mask`, `z_final` and canvas layer. */
export interface ItemPlacement {
  readonly lightMask: number;
  readonly z: number;
  readonly layer: number;
  /**
   * The ordinals of the lights on the item's list, the positional ones from `itemPositionalLights`,
   * while more than 15 meet its rect or the render's budget drops one. Null otherwise: the item then
   * reads its placement's list.
   */
  readonly takenLights: readonly number[] | null;
}

/** The positional lights an item takes, `renderer_canvas_render_rd.cpp:2380`. */
export const MAX_POSITIONAL_LIGHTS_PER_ITEM = MAX_LIGHTS_PER_ITEM - 1;

/** The ordinals of the lights `rankOf` ranks, in list order: rank, then ordinal. */
function listOrder(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  rankOf: (light: CanvasLightDeclaration) => number | null
): number[] {
  const listed: { ordinal: number; rank: number }[] = [];
  for (const [ordinal, light] of lights) {
    const rank = rankOf(light);
    if (rank !== null) listed.push({ ordinal, rank });
  }
  listed.sort((a, b) => a.rank - b.rank || a.ordinal - b.ordinal);
  return listed.map((light) => light.ordinal);
}

/** The positional lights in list order: sequence, then ordinal. */
export function positionalListOrder(lights: ReadonlyMap<number, CanvasLightDeclaration>): number[] {
  return listOrder(lights, (light) => light.sequence);
}

/** The directional lights in list order: slot, then ordinal. */
export function directionalListOrder(lights: ReadonlyMap<number, CanvasLightDeclaration>): number[] {
  return listOrder(lights, (light) => (light.sequence === null ? (light.slot ?? 0) : null));
}

/**
 * The positional lights of `positionalOrder` that pass the cull test at `item`, in list order.
 * More than `MAX_POSITIONAL_LIGHTS_PER_ITEM` crowds the placement, so each item's rect picks.
 */
export function positionalCandidates(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  positionalOrder: readonly number[],
  item: ItemPlacement
): number[] {
  return positionalOrder.filter((ordinal) => {
    const { reach } = lights.get(ordinal)!;
    return lightReachesItem(reach, item.lightMask, item.z, item.layer);
  });
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

/** Whether `light` is on `item`'s list: it passes the cull test and, if the list is capped, the item takes it. */
function itemTakesLight(
  light: CanvasLightDeclaration,
  ordinal: number,
  item: ItemPlacement,
  taken: ReadonlySet<number> | null
): boolean {
  if (!lightReachesItem(light.reach, item.lightMask, item.z, item.layer)) return false;
  return taken === null || taken.has(ordinal);
}

/** The lights on `item`'s list, in ordinal order. */
function itemLightList(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  item: ItemPlacement
): LightListEntry[] {
  const list: LightListEntry[] = [];
  const taken = item.takenLights && new Set(item.takenLights);
  for (const [ordinal, light] of lights) {
    if (!itemTakesLight(light, ordinal, item, taken)) continue;
    const shadowMask = light.shadowItemCullMask;
    list.push({ ordinal, unshadowed: shadowMask !== null && (shadowMask & item.lightMask) === 0 });
  }
  return list.sort((a, b) => a.ordinal - b.ordinal);
}

/** A canonical string for a list, so two items with the same list share a buffer. */
function lightListId(list: readonly LightListEntry[]): string {
  return list.map((entry) => `${entry.ordinal}${entry.unshadowed ? 'u' : 's'}`).join(',');
}

/** The list as a string, once per list: the lists of one frame are shared between items. */
const takenLightsId = perObject((takenLights: readonly number[]) => takenLights.join(','));

/** A string for a placement, for use as a Map key. */
export function placementId(item: ItemPlacement): string {
  const taken = item.takenLights ? takenLightsId(item.takenLights) : '*';
  return `${item.lightMask}|${item.z}|${item.layer}|${taken}`;
}

/**
 * The accumulation a lit item reads: the ordinary one, the one seeded from white for a Light Only
 * item, or each light apart for a normal-mapped item, whatever its light mode.
 */
export type LitItemRead = 'plain' | 'lightOnly' | 'apart';

/** One placement the canvas holds a lit item at, and what its items read. */
export interface PlacementDeclarations {
  readonly placement: ItemPlacement;
  readonly reads: ReadonlySet<LitItemRead>;
}

/** One list the pass accumulates, and the placements that read it. */
export interface LightListPlan {
  /** `lightListId` of the entries. */
  readonly id: string;
  readonly entries: readonly LightListEntry[];
  readonly placementIds: readonly string[];
  /** What the list's items read, so the pass draws only those buffers. */
  readonly reads: ReadonlySet<LitItemRead>;
  /** Whether a light that tints its shadow shadows the list, so it needs the `shadow_color` buffer. */
  readonly tintsShadow: boolean;
  /** The lights kept apart, while a normal-mapped item reads the list. Null otherwise. */
  readonly lightsApart: ApartLightPlan | null;
}

/** The lights of a list a normal-mapped item reads, each accumulated alone into a layer. */
export interface ApartLightPlan {
  /** The entries in layer order, which is the order Godot applies them. */
  readonly entries: readonly LightListEntry[];
  /**
   * Each entry's layer in a `shadow_color` buffer that holds only the lights that add one, or -1 for
   * a light that adds none.
   */
  readonly tintLayers: readonly number[];
  /** How many lights add a `shadow_color`, the layers of that buffer. */
  readonly tintLayerCount: number;
}

/** Whether `entry`'s light adds a `shadow_color` on its list: it tints, and shadows the list. */
function entryTintsShadow(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  entry: LightListEntry
): boolean {
  return !entry.unshadowed && lights.get(entry.ordinal)!.tintsShadow;
}

/**
 * `entries` in the order `canvas.glsl` applies them: the directional lights by slot (`:727`), then
 * the positional lights by sequence (`:768`).
 */
function applicationOrder(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  entries: readonly LightListEntry[]
): LightListEntry[] {
  const byOrdinal = new Map(entries.map((entry) => [entry.ordinal, entry]));
  return [...directionalListOrder(lights), ...positionalListOrder(lights)]
    .map((ordinal) => byOrdinal.get(ordinal))
    .filter((entry) => entry !== undefined);
}

function apartLightPlan(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  entries: readonly LightListEntry[]
): ApartLightPlan {
  const ordered = applicationOrder(lights, entries);
  let tintLayerCount = 0;
  const tintLayers = ordered.map((entry) => (entryTintsShadow(lights, entry) ? tintLayerCount++ : -1));
  return { entries: ordered, tintLayers, tintLayerCount };
}

/** The lists the canvas's lit placements take, one plan per distinct list, empty lists left out. */
export function planLightLists(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placements: ReadonlyMap<string, PlacementDeclarations>
): LightListPlan[] {
  const lists = new Map<
    string,
    { entries: LightListEntry[]; placementIds: string[]; reads: Set<LitItemRead> }
  >();
  for (const [id, { placement, reads }] of placements) {
    const entries = itemLightList(lights, placement);
    if (entries.length === 0) continue;
    const listId = lightListId(entries);
    const list = lists.get(listId) ?? { entries, placementIds: [], reads: new Set<LitItemRead>() };
    list.placementIds.push(id);
    for (const read of reads) list.reads.add(read);
    lists.set(listId, list);
  }
  return [...lists].map(([id, { entries, placementIds, reads }]) => ({
    id,
    entries,
    placementIds,
    reads,
    tintsShadow: entries.some((entry) => entryTintsShadow(lights, entry)),
    lightsApart: reads.has('apart') ? apartLightPlan(lights, entries) : null,
  }));
}

/**
 * What a light mesh is to the pass. A light's `lit` quad draws its authored shadow, `tint` adds its
 * `shadow_color`, and `unshadowed` is its quad without the shadow. Each light writes both buffers
 * over its whole reach with one alpha, so a MIX light scales both: `fade` and `unshadowedFade`
 * carry the lit alpha into the tint pass of a light whose tint quad does not.
 */
export type PassMeshRole = 'lit' | 'tint' | 'fade' | 'unshadowed' | 'unshadowedFade';

/** `light` accumulates `S`, from either seed. `tint` accumulates the albedo-free `shadow_color`. */
export type PassKind = 'light' | 'tint';

/** The entry a role draws for, by its `unshadowed` flag, and the passes it draws in. */
const ROLE_PASSES: Readonly<Record<PassMeshRole, { unshadowed: boolean; kinds: readonly PassKind[] }>> = {
  lit: { unshadowed: false, kinds: ['light'] },
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
