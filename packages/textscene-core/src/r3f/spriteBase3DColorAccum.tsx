/**
 * `SpriteBase3D::_get_color_accum()` (`sprite_3d.cpp:36-52`) — a sprite's drawn
 * colour is its parent's accumulated colour × its own modulate, all four
 * channels, consumed as the vertex colour at `:124`.
 *
 * NOT a cascading tint. `parent_sprite` is
 * `Object::cast_to<SpriteBase3D>(get_parent())` (`sprite_3d.cpp:75`), the
 * IMMEDIATE parent and nothing further: one intervening node of any other type
 * restarts the accumulation at white. That is why this cannot be the 2D
 * `Modulate2DContext` shape, which reaches every descendant.
 *
 * The rule is structural rather than checked: `SpriteBase3DChildAccum` takes the
 * node whose children it wraps, never a value, so there is no way to hand it an
 * accumulation from anywhere but the immediate parent — and the dispatcher wraps
 * EVERY node's children in it, so a non-sprite level always overwrites with
 * white instead of letting a grandparent's value through.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { multiplyModulate, WHITE_MODULATE, type RGBA } from './canvasItemModulate.js';

/** The `SpriteBase3D` subclasses (`sprite_3d.h:36`) — `cast_to<SpriteBase3D>` in type-name terms. */
export const SPRITE_BASE_3D_TYPES: ReadonlySet<string> = new Set(['Sprite3D']);

/** The IMMEDIATE parent's accumulation; white unless that parent is itself a SpriteBase3D. */
const ParentColorAccumContext = createContext<RGBA>(WHITE_MODULATE);

/** One node's step of the accumulation — the four `*=` at `sprite_3d.cpp:47-50`. */
function accumulate(parentAccum: RGBA, modulate: RGBA): RGBA {
  return multiplyModulate(parentAccum, modulate);
}

/** This sprite's own `_get_color_accum()`, in the sRGB space Godot multiplies in. */
export function useSpriteBase3DColorAccum(modulate: RGBA): RGBA {
  const parentAccum = useContext(ParentColorAccumContext);
  return useMemo(() => accumulate(parentAccum, modulate), [parentAccum, modulate]);
}

/** Publishes `node`'s accumulation to its children, or white when `node` is outside the family. */
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
