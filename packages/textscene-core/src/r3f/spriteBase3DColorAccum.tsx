/**
 * `SpriteBase3D::_get_color_accum()` (`sprite_3d.cpp:36-52`): a sprite's drawn
 * colour is its parent's accumulated colour × its own modulate, all four channels,
 * used as the vertex colour at `:124`. `parent_sprite` is the immediate parent only
 * (`sprite_3d.cpp:75`), so this is not the cascading `Modulate2DContext` shape.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { multiplyModulate, WHITE_MODULATE, type RGBA } from './canvasItemModulate.js';

/** The `SpriteBase3D` subclasses (`sprite_3d.h:36`): `cast_to<SpriteBase3D>` in type-name terms. */
export const SPRITE_BASE_3D_TYPES: ReadonlySet<string> = new Set(['Sprite3D']);

/** The immediate parent's accumulation, white unless that parent is a SpriteBase3D. */
const ParentColorAccumContext = createContext<RGBA>(WHITE_MODULATE);

/** One node's step of the accumulation: the four `*=` at `sprite_3d.cpp:47-50`. */
function accumulate(parentAccum: RGBA, modulate: RGBA): RGBA {
  return multiplyModulate(parentAccum, modulate);
}

/** This sprite's own `_get_color_accum()`, in the sRGB space Godot multiplies in. */
export function useSpriteBase3DColorAccum(modulate: RGBA): RGBA {
  const parentAccum = useContext(ParentColorAccumContext);
  return useMemo(() => accumulate(parentAccum, modulate), [parentAccum, modulate]);
}

/**
 * Publishes `node`'s accumulation to its children, or white outside the family.
 * It takes a node, never a value, and the dispatcher wraps every node's children
 * in it, so an intervening non-sprite restarts the accumulation at white.
 */
export function SpriteBase3DChildAccum({ node, children }: { node: TscnNode; children: ReactNode }) {
  const parentAccum = useContext(ParentColorAccumContext);
  const modulate = (node.properties as { modulate?: RGBA }).modulate;
  const value = useMemo(
    () =>
      SPRITE_BASE_3D_TYPES.has(node.type) && modulate
        ? accumulate(parentAccum, modulate)
        : WHITE_MODULATE,
    [node.type, modulate, parentAccum]
  );
  return <ParentColorAccumContext.Provider value={value}>{children}</ParentColorAccumContext.Provider>;
}
