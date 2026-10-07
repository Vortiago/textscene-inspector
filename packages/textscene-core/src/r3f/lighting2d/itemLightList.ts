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

import { lightReachesItem, type LightCullKey } from './lightCullKey.js';

/** What a light tells the pass about itself. */
export interface CanvasLightDeclaration {
  /** Which items the light reaches (`lightCullKey`). */
  readonly reach: LightCullKey;
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

/** The lights that reach `item`, in ordinal order. */
export function itemLightList(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  item: ItemPlacement
): LightListEntry[] {
  const list: LightListEntry[] = [];
  for (const [ordinal, light] of lights) {
    if (!lightReachesItem(light.reach, item.lightMask, item.z, item.layer)) continue;
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
  return `${item.lightMask}|${item.z}|${item.layer}`;
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
 * shadow, `tint` adds its `shadow_color`, and `unshadowed` is its quad without the shadow.
 */
export type PassMeshRole = 'volume' | 'lit' | 'tint' | 'unshadowed';

/** `light` accumulates `S`, from either seed. `tint` accumulates the albedo-free `shadow_color`. */
export type PassKind = 'light' | 'tint';

/** Whether a light's mesh of `role` draws in a `kind` pass over a list holding `entry`. */
export function drawsInPass(entry: LightListEntry | undefined, role: PassMeshRole, kind: PassKind): boolean {
  if (entry === undefined) return false;
  if (entry.unshadowed) return kind === 'light' && role === 'unshadowed';
  if (kind === 'light') return role === 'volume' || role === 'lit';
  return role === 'volume' || role === 'tint';
}
