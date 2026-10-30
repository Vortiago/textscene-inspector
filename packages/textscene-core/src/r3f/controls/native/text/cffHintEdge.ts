/**
 * The edges of a Type 2 charstring's stem hints, the unit that blue zones capture and the hint map
 * aligns to the pixel grid. A stem is a pair of edges, or a ghost: one edge declared by a stem of
 * width -20 or -21.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { doubleToFixed, intToFixed } from './cffFixed';
import { ftMulFix } from './fontMetrics';

/** `CF2_HintRec` flags. */
export const EdgeFlag = {
  GhostBottom: 0x1,
  GhostTop: 0x2,
  PairBottom: 0x4,
  PairTop: 0x8,
  Locked: 0x10,
  Synthetic: 0x20,
} as const;

/** `CF2_StemHintRec`: a stem as the charstring declares it, and where it landed once a hint map used it. */
export interface StemHint {
  /** Character space, 16.16. */
  min: number;
  max: number;
  /** True once a hint map has placed the stem: `minDS` and `maxDS` are then valid, and a later map keeps them. */
  used: boolean;
  /** Device space, 16.16. */
  minDS: number;
  maxDS: number;
}

/** `CF2_HintRec`: one edge. A `flags` of 0 is no edge. */
export interface HintEdge {
  flags: number;
  /** Where the font puts the edge, in character space. */
  csCoord: number;
  /** Where the hint map puts it, in device space. */
  dsCoord: number;
  /** The slope of device space over character space from this edge up to the next. */
  scale: number;
  /** The stem the edge came from, in the stem array. */
  index: number;
}

/** `CF2_MIN_COUNTER`: the least space, in pixels, between two hint edges. */
export const MIN_COUNTER = doubleToFixed(0.5);

/** The ghost-bottom width, and the ghost-top width. A stem of either has one edge. */
const GHOST_BOTTOM_WIDTH = intToFixed(-21);
const GHOST_TOP_WIDTH = intToFixed(-20);

const has = (edge: HintEdge, flags: number) => (edge.flags & flags) !== 0;

export const isValidEdge = (edge: HintEdge) => edge.flags !== 0;
export const isPairEdge = (edge: HintEdge) => has(edge, EdgeFlag.PairBottom | EdgeFlag.PairTop);
export const isPairTopEdge = (edge: HintEdge) => has(edge, EdgeFlag.PairTop);
export const isTopEdge = (edge: HintEdge) => has(edge, EdgeFlag.PairTop | EdgeFlag.GhostTop);
export const isBottomEdge = (edge: HintEdge) => has(edge, EdgeFlag.PairBottom | EdgeFlag.GhostBottom);
export const isLockedEdge = (edge: HintEdge) => has(edge, EdgeFlag.Locked);
export const isSyntheticEdge = (edge: HintEdge) => has(edge, EdgeFlag.Synthetic);

export function noEdge(): HintEdge {
  return { flags: 0, csCoord: 0, dsCoord: 0, scale: 0, index: 0 };
}

/**
 * The bottom or the top edge of `stem` (`cf2_hint_init`), or no edge when a ghost stem has none
 * there. A stem used before keeps its place and is locked. `hintOrigin` is where a `seac` accent
 * starts, which moves its stems.
 */
export function stemEdge(
  stem: StemHint,
  index: number,
  isBottom: boolean,
  hintOrigin: number,
  scale: number
): HintEdge {
  const width = stem.max - stem.min;
  let csCoord = 0;
  let flags = 0;
  if (width === GHOST_BOTTOM_WIDTH) {
    if (isBottom) {
      csCoord = stem.max;
      flags = EdgeFlag.GhostBottom;
    }
  } else if (width === GHOST_TOP_WIDTH) {
    if (!isBottom) {
      csCoord = stem.min;
      flags = EdgeFlag.GhostTop;
    }
  } else {
    // An inverted pair swaps its edges: CoolType does, and so does FreeType.
    const [low, high] = width < 0 ? [stem.max, stem.min] : [stem.min, stem.max];
    csCoord = isBottom ? low : high;
    flags = isBottom ? EdgeFlag.PairBottom : EdgeFlag.PairTop;
  }

  csCoord += hintOrigin;
  const edge = { flags, csCoord, dsCoord: ftMulFix(csCoord, scale), scale, index };
  if (flags === 0 || !stem.used) return edge;
  edge.dsCoord = isTopEdge(edge) ? stem.maxDS : stem.minDS;
  edge.flags |= EdgeFlag.Locked;
  return edge;
}
