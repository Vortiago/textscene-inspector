/**
 * Adapts a Control's `modulate`/`self_modulate` (`ControlColor`, the parsed
 * 0..1 channel shape `ControlProperties` carries) onto the existing 2D
 * CanvasItem tint chain: `multiplyModulate` + `useGodotLinearColor` via
 * `useCanvasItemTint`, the SAME hook Sprite2D/TileMap/every other CanvasItem
 * uses, so a Control composes with an ancestor's `Modulate2DContext` value
 * exactly like any other 2D node. Per that module's own rule, colors compose
 * in sRGB (the space Godot's `Color(...)` literals are written in) and
 * convert to the renderer's linear working space exactly ONCE, at the end of
 * the chain — this module does not re-derive that, only supplies the two
 * `ControlColor`s the chain multiplies.
 *
 * The split is the whole point: the WALKER folds `modulate` (hierarchical),
 * a PAINTER folds `self_modulate` (own pixels only). Neither hook can reach
 * the other's field.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import {
  useCanvasItemTint,
  useParentModulate,
  WHITE_MODULATE,
  multiplyModulate,
  type RGBA,
} from '../../canvasItemModulate';
import { controlProps, type SolveNode } from './solveTree';

/** `ControlColor` is structurally an `RGBA`, so an absent one is the only case. */
function toRGBA(c: ControlColor | undefined): RGBA {
  return c ?? WHITE_MODULATE;
}

/**
 * The value a Control's DESCENDANTS inherit: ancestor tint × this node's
 * `modulate`. Walker-only — a painter renders inside the provider this feeds,
 * so it must never call this. Absent `modulate` means "no tint", matching
 * Godot's own opaque-white default.
 */
export function useInheritedModulate(modulate: ControlColor | undefined): RGBA {
  const parent = useParentModulate();
  const own = toRGBA(modulate);
  return useMemo(() => multiplyModulate(parent, own), [parent, own]);
}

/**
 * What a painter gets — `CanvasItemTint` minus `inherited`, spelled out rather
 * than `Omit`-ed so a later field on that type cannot leak into every painter.
 */
export interface ControlOwnTint {
  /** The own-pixel product, still raw sRGB — for a widget composing further base colours. */
  own: RGBA;
  /** Linear-space own-pixel tint. */
  color: THREE.Color;
  /** Own-pixel opacity. */
  opacity: number;
}

/**
 * A painter's OWN-pixel tint: the ambient inherited value (which already
 * carries this node's `modulate`) × its `self_modulate` × `ownMultiplier`.
 *
 * Two base-colour seams, both load-bearing: `ownMultiplier` for a widget with
 * a single colour, and post-hook `tintColor(base, tint.own)` for one with
 * several (a StyleBox's fill and border, a per-run bbcode colour).
 */
export function useControlOwnTint(solveNode: SolveNode, ownMultiplier?: RGBA): ControlOwnTint {
  const selfModulate = toRGBA(controlProps(solveNode).selfModulate);
  const props = useMemo(
    () => ({ modulate: WHITE_MODULATE, self_modulate: selfModulate }),
    [selfModulate]
  );
  const { own, color, opacity } = useCanvasItemTint(props, ownMultiplier);
  return { own, color, opacity };
}
