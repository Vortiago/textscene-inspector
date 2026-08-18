/**
 * The declaring side of the 2D light pass: what a light or a canvas item says
 * about itself, and the layer it is told to draw on in return.
 *
 * Every one of these is an EFFECT rather than a render-time call. A declaration
 * has to unwind on unmount, and a provider `setState` reached from a child's
 * render is a React update-during-render.
 */

import { useCallback, useEffect, useState } from 'react';
import { LIGHT_UNCLASSED_LAYER } from './lightPassLayers.js';
import { sameLightCullKey, type LightCullKey } from './lightCullKey.js';
import { useCanvasLighting2D, type CanvasLightClass } from './lightPassContext.js';

/**
 * Holds a declaration about this cull tuple open for as long as `enabled` is,
 * and unwinds it when that stops holding, when a number in the tuple changes,
 * or on unmount. `declare` returns the unwind.
 *
 * The effect depends on the tuple's five NUMBERS rather than on the key object,
 * and rebuilds the key inside itself. A light rebuilds its key on any
 * re-render, so an object dependency would withdraw and re-declare — and
 * therefore reshuffle every ordinal in its class — on a render that changed
 * nothing. `declare` is a dependency for the same reason and has to survive
 * such a render too: pass a context registrar, or a `useCallback`.
 *
 * Every keyed declaration below goes through here, so that rule holds in one
 * place rather than once per hook that remembers it.
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
 * Declares that a light of this cull tuple is present. The classes are what
 * gate the accumulators: with no lights none is allocated and every canvas item
 * reads its canvas modulate straight from its uniform, which is the 3D
 * workspace and most fixtures.
 *
 * Returns the light's ordinal within its class, which is what its stencil ref is
 * derived from. It is 0 for the frame between mounting and the effect running,
 * and 0 is a legitimate ordinal, so an unregistered light shares a ref with the
 * first registered one for exactly that frame.
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
 * Declares an item whose light mode needs the unmodulated accumulation. An item
 * reads whatever classes exist rather than belonging to one, so this carries no
 * cull tuple and none of the dependency care a tuple needs.
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
 * The camera layer a light draws its `shadow_color` quad on, or undefined while
 * its class has none. Separate from `useLightClassLayer` because the tint pass
 * must NOT see the cookie quads.
 */
export function useShadowTintLayer(key: LightCullKey): number | undefined {
  return useLightClass(key)?.shadowTintLayer;
}
