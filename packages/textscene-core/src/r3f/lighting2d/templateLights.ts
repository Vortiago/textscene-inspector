/**
 * The lights of a canvas item that draws through Godot's canvas template: the rows of its layer's
 * `light_array` (`renderer_canvas_render_rd.cpp:519-660`) and the indices it takes (`:2366-2386`).
 */

import { MAX_LIGHTS_PER_RENDER } from '../../godot/rendering/rendering.js';
import {
  itemLightBits,
  MAX_POSITIONAL_LIGHTS,
  type ItemLightBits,
} from '../../shaders/canvas/canvasLights.js';
import { perObject } from '../../utils/perObject.js';
import { lightReachesItem, reachesCanvasLayer } from './lightCullKey.js';
import {
  directionalListOrder,
  positionalCandidates,
  positionalListOrder,
  type CanvasLightDeclaration,
  type ItemPlacement,
} from './itemLightList.js';

/** The lights a canvas layer's render lists, each at its index of `light_array`. */
export interface LayerLightOrder {
  readonly ordinals: readonly number[];
  /** The directional lights, which come first: `canvas_data.directional_light_count`. */
  readonly directionalCount: number;
}

/** Each `lights` state's orders by layer, collected with the state. */
const ordersOf = perObject((lights: ReadonlyMap<number, CanvasLightDeclaration>) => ({
  positional: positionalListOrder(lights),
  directional: directionalListOrder(lights),
  byLayer: new Map<number, LayerLightOrder>(),
}));

/** The directional lights by slot, then the positional ones by sequence, on `layer`, at most 256. */
export function layerLightOrder(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  layer: number
): LayerLightOrder {
  const orders = ordersOf(lights);
  let order = orders.byLayer.get(layer);
  if (order) return order;
  const onLayer = (ordinal: number) => reachesCanvasLayer(lights.get(ordinal)!.reach, layer);
  const directional = orders.directional.filter(onLayer).slice(0, MAX_LIGHTS_PER_RENDER);
  const positional = orders.positional.filter(onLayer);
  order = {
    ordinals: [...directional, ...positional].slice(0, MAX_LIGHTS_PER_RENDER),
    directionalCount: directional.length,
  };
  orders.byLayer.set(layer, order);
  return order;
}

/**
 * The light bits of an item at `placement`. `godotLights` is the cap's list of the positional
 * lights that meet the item's rect, or null where every light that reaches the placement fits.
 */
export function itemTemplateLights(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placement: ItemPlacement,
  godotLights: readonly number[] | null
): ItemLightBits {
  const order = layerLightOrder(lights, placement.layer);
  const taken = godotLights ?? positionalCandidates(lights, ordersOf(lights).positional, placement);
  const indices: number[] = [];
  for (const ordinal of taken) {
    const index = order.ordinals.indexOf(ordinal);
    if (index >= order.directionalCount) indices.push(index);
  }
  return itemLightBits(indices.slice(0, MAX_POSITIONAL_LIGHTS));
}

/**
 * Whether a light that reaches `placement` shadows it: a directional light that casts, or a
 * positional one whose `shadow_item_cull_mask` meets the item's mask (`canvas.glsl:747, 807`).
 */
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
