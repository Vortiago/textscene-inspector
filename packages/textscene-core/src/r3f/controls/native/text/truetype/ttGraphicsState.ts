/**
 * The graphics state of the TrueType interpreter (`TT_GraphicsState`, `ttobjs.h`) and its default
 * (`tt_default_graphics_state`, `ttinterp.c`). A state copies by spread: its vectors are never
 * changed in place, an instruction sets a new one. The scan control and scan type are left out:
 * only the rasteriser reads them, and an outline is the same without them.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { F2DOT14_ONE, type UnitVector } from './ttArithmetic';
import { RoundState, type RoundStateValue } from './ttRounding';

/** The zone number of the twilight zone, which a glyph's points never sit in. */
export const TWILIGHT_ZONE = 0;
/** The zone number of the glyph's own points. */
export const GLYPH_ZONE = 1;

export interface GraphicsState {
  rp0: number;
  rp1: number;
  rp2: number;
  gep0: number;
  gep1: number;
  gep2: number;
  dualVector: UnitVector;
  projVector: UnitVector;
  freeVector: UnitVector;
  loop: number;
  roundState: RoundStateValue;
  minimumDistance: number;
  controlValueCutIn: number;
  singleWidthCutIn: number;
  singleWidthValue: number;
  deltaBase: number;
  deltaShift: number;
  isAutoFlip: boolean;
  /** INSTCTRL's flags: 1 turns hinting off, 2 keeps the default state for glyphs, 4 waives backward compatibility. */
  instructControl: number;
}

const X_AXIS: UnitVector = { x: F2DOT14_ONE, y: 0 };

/** A fresh `tt_default_graphics_state`. */
export function defaultGraphicsState(): GraphicsState {
  return {
    rp0: 0,
    rp1: 0,
    rp2: 0,
    gep0: GLYPH_ZONE,
    gep1: GLYPH_ZONE,
    gep2: GLYPH_ZONE,
    dualVector: X_AXIS,
    projVector: X_AXIS,
    freeVector: X_AXIS,
    loop: 1,
    roundState: RoundState.GRID,
    minimumDistance: 64,
    controlValueCutIn: 68,
    singleWidthCutIn: 0,
    singleWidthValue: 0,
    deltaBase: 9,
    deltaShift: 3,
    isAutoFlip: true,
    instructControl: 0,
  };
}

/**
 * `TT_Save_Context`: the fields of `from` that the font and control value programs may change,
 * written into `into`. The rest of `into` stays as it was.
 */
export function saveProgramState(into: GraphicsState, from: GraphicsState): void {
  into.minimumDistance = from.minimumDistance;
  into.controlValueCutIn = from.controlValueCutIn;
  into.singleWidthCutIn = from.singleWidthCutIn;
  into.singleWidthValue = from.singleWidthValue;
  into.deltaBase = from.deltaBase;
  into.deltaShift = from.deltaShift;
  into.isAutoFlip = from.isAutoFlip;
  into.instructControl = from.instructControl;
}
