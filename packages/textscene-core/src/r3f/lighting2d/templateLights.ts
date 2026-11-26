import { MAX_LIGHTS_PER_RENDER, MAX_POSITIONAL_LIGHTS_PER_ITEM } from '../../godot/rendering/rendering.js';
import { itemLightBits, type ItemLightBits } from '../../shaders/canvas/canvasLights.js';
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
  /** Each listed light's index of `light_array`, by ordinal. */
  readonly indexOf: ReadonlyMap<number, number>;
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
  const ordinals = [...directional, ...positional].slice(0, MAX_LIGHTS_PER_RENDER);
  order = {
    ordinals,
    indexOf: new Map(ordinals.map((ordinal, index) => [ordinal, index])),
    directionalCount: directional.length,
  };
  orders.byLayer.set(layer, order);
  return order;
}

/** The light bits at `placement`. `godotLights` is null where every reaching light fits (`:2366-2386`). */
export function itemTemplateLights(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  placement: ItemPlacement,
  godotLights: readonly number[] | null
): ItemLightBits {
  const order = layerLightOrder(lights, placement.layer);
  const taken = godotLights ?? positionalCandidates(lights, ordersOf(lights).positional, placement);
  const indices: number[] = [];
  for (const ordinal of taken) {
    const index = order.indexOf.get(ordinal);
    if (index !== undefined && index >= order.directionalCount) indices.push(index);
  }
  return itemLightBits(indices.slice(0, MAX_POSITIONAL_LIGHTS_PER_ITEM));
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
