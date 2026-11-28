import { perObject } from '../../utils/perObject.js';
import { lightReachesItem, reachesCanvasLayer } from './lightCullKey.js';
import {
  directionalListOrder,
  positionalCandidates,
  positionalListOrder,
  type CanvasLightDeclaration,
  type ItemPlacement,
} from './itemLightList.js';

/** The lights a canvas layer can list, in Godot's order: each render lists those on screen. */
export interface LayerLightCandidates {
  /** The directional lights by slot: `canvas_data.directional_light_count` counts the listed ones. */
  readonly directional: readonly number[];
  /** The positional lights by sequence. */
  readonly positional: readonly number[];
}

/** Each `lights` state's orders by layer, collected with the state. */
const ordersOf = perObject((lights: ReadonlyMap<number, CanvasLightDeclaration>) => ({
  positional: positionalListOrder(lights),
  directional: directionalListOrder(lights),
  byLayer: new Map<number, LayerLightCandidates>(),
}));

/** The directional lights by slot, then the positional ones by sequence, that reach `layer`. */
export function layerLightCandidates(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  layer: number
): LayerLightCandidates {
  const orders = ordersOf(lights);
  let candidates = orders.byLayer.get(layer);
  if (candidates) return candidates;
  const onLayer = (ordinal: number) => reachesCanvasLayer(lights.get(ordinal)!.reach, layer);
  candidates = {
    directional: orders.directional.filter(onLayer),
    positional: orders.positional.filter(onLayer),
  };
  orders.byLayer.set(layer, candidates);
  return candidates;
}

/** An item's positional lights in loop order: the cap's `godotLights`, else all that reach it (`:2366`). */
export function itemTemplateLights(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placement: ItemPlacement,
  godotLights: readonly number[] | null
): readonly number[] {
  return godotLights ?? positionalCandidates(lights, ordersOf(lights).positional, placement);
}

/** Whether a light that reaches `placement` casts a shadow on it (`canvas.glsl:747, 807`). */
export function isShadowedByLight(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placement: ItemPlacement
): boolean {
  for (const light of lights.values()) {
    const { lightMask, z, layer } = placement;
    if (!light.castsShadow || !lightReachesItem(light.reach, lightMask, z, layer)) continue;
    if (light.sequence === null) return true;
    if (((light.shadowItemCullMask ?? 0) & placement.lightMask) !== 0) return true;
  }
  return false;
}
