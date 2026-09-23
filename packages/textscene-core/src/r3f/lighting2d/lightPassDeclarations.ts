/**
 * The declaring side of the 2D light pass: what a light or an item says about itself, and the
 * layer it draws on in return. Each is an effect: a declaration unwinds on unmount, and a provider
 * `setState` from a child's render is an update during render.
 */

import { useCallback, useEffect, useState } from 'react';
import { LIGHT_UNCLASSED_LAYER } from './lightPassLayers.js';
import { sameLightCullKey, type LightCullKey } from './lightCullKey.js';
import { useCanvasLighting2D, type CanvasLightClass } from './lightPassContext.js';

/**
 * Holds a declaration open while `enabled` holds, until a tuple number changes or unmount. It
 * depends on the five numbers, not the key object a light rebuilds each render, which would
 * reshuffle its class's ordinals. `declare` returns the unwind and must be stable too: a context
 * registrar or a `useCallback`. Every keyed declaration goes through here.
 */
function useCullDeclaration(
  enabled: boolean,
  key: LightCullKey,
  declare: (key: LightCullKey) => () => void
): void {
  const { itemCullMask, zMin, zMax, layerMin, layerMax } = key;
  useEffect(() => {
    if (!enabled) return undefined;
    return declare({ itemCullMask, zMin, zMax, layerMin, layerMax });
  }, [enabled, itemCullMask, zMin, zMax, layerMin, layerMax, declare]);
}

/**
 * Declares a light of this cull tuple. With no lights, no accumulator exists and items read the
 * canvas modulate from their uniform. Returns the ordinal its stencil ref derives from, which is 0,
 * the first light's ordinal, for the one frame before the effect runs.
 */
export function useRegisterCanvasLight2D(enabled: boolean, key: LightCullKey): number {
  const { register } = useCanvasLighting2D();
  const [ordinal, setOrdinal] = useState(0);
  const declare = useCallback(
    (cullKey: LightCullKey) => {
      const slot = register(cullKey);
      setOrdinal(slot.ordinal);
      return slot.release;
    },
    [register]
  );
  useCullDeclaration(enabled, key, declare);
  return ordinal;
}

/** Declares a light that tints its shadow, so its class allocates the extra pass. */
export function useRegisterShadowTint(enabled: boolean, key: LightCullKey): void {
  const { registerShadowTint } = useCanvasLighting2D();
  useCullDeclaration(enabled, key, registerShadowTint);
}

/**
 * Declares an item whose light mode needs the unmodulated accumulation. An item reads every class
 * rather than belonging to one, so this carries no cull tuple.
 */
export function useRegisterLightOnlyItem(enabled: boolean): void {
  const { registerLightOnly } = useCanvasLighting2D();
  useEffect(() => {
    if (!enabled) return undefined;
    return registerLightOnly();
  }, [enabled, registerLightOnly]);
}

/** The class accumulating this cull tuple, or undefined while it has none. */
function useLightClass(key: LightCullKey): CanvasLightClass | undefined {
  const { classes } = useCanvasLighting2D();
  return classes.find((lightClass) => sameLightCullKey(lightClass.key, key));
}

/**
 * The camera layer a light of this cull tuple must draw its quad on: the layer
 * of its class, or `LIGHT_UNCLASSED_LAYER` while it has none.
 */
export function useLightClassLayer(key: LightCullKey): number {
  return useLightClass(key)?.layer ?? LIGHT_UNCLASSED_LAYER;
}

/**
 * The camera layer a light draws its `shadow_color` quad on, or undefined while its class has
 * none. Separate from `useLightClassLayer` because the tint pass must not see the cookie quads.
 */
export function useShadowTintLayer(key: LightCullKey): number | undefined {
  return useLightClass(key)?.shadowTintLayer;
}
