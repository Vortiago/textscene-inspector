/**
 * The alignment zones of a font's Private DICT at one scale: the bands, near the baseline, x-height
 * and cap height, where an edge of a stem hint snaps to a pixel. A zone captures an edge that
 * falls in it, and where the edge lands depends on the size: small sizes suppress overshoot.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { doubleToFixed, intToFixed, roundFixed } from './cffFixed';
import { EdgeFlag, MIN_COUNTER, isBottomEdge, isTopEdge, isValidEdge, type HintEdge } from './cffHintEdge';
import type { PrivateBlues } from './cffPrivateDict';
import { FIXED_16_16_ONE, ftDivFix, ftMulDiv, ftMulFix } from './fontMetrics';

interface Zone {
  csBottomEdge: number;
  csTopEdge: number;
  /** The top edge of a bottom zone, the bottom edge of a top zone, snapped to a Family zone within a pixel. */
  csFlatEdge: number;
  /** The flat edge in device space, on a whole pixel. */
  dsFlatEdge: number;
  isBottom: boolean;
}

/** `CF2_ICF_Top` and `CF2_ICF_Bottom`: the ideographic character face of a 1000-unit em. */
const ICF_TOP = intToFixed(880);
const ICF_BOTTOM = intToFixed(-120);

/** An edge nudged outward by this does not meet a real hint at the same height. */
const EPSILON = 1;

/** The overshoot boost never reaches half a pixel, or the baseline could go below zero. */
const MAX_BOOST = 0x7fff;
/** The overshoot boost at a scale of zero, in pixels. */
const BOOST_AT_ZERO = doubleToFixed(0.6);

const LANGUAGE_GROUP_IDEOGRAPHIC = 1;

export class BlueZones {
  /**
   * The ghost hints at the top and bottom of the em box that an ideographic font without real
   * zones gets, or null. Such a font's zones are ignored.
   */
  readonly emBoxEdges: { bottom: HintEdge; top: HintEdge } | null;
  private readonly zones: Zone[];
  private readonly blueFuzz: number;
  private readonly blueShift: number;
  private readonly suppressesOvershoot: boolean;

  /** `scale` takes character space to device space, 16.16: the font size over the em. */
  constructor(
    privateBlues: PrivateBlues,
    readonly scale: number
  ) {
    this.blueFuzz = intToFixed(privateBlues.blueFuzz);
    this.blueShift = intToFixed(privateBlues.blueShift);
    this.emBoxEdges = hasEmBoxHeuristic(privateBlues) ? emBoxEdgesAt(scale) : null;
    if (this.emBoxEdges) {
      this.zones = [];
      this.suppressesOvershoot = false;
      return;
    }

    const { zones, maxHeight } = zonesOf(privateBlues);
    snapToFamilyEdges(zones, privateBlues, scale);
    // BlueScale cannot exceed the scale at which the tallest zone is one pixel.
    const blueScale =
      maxHeight > 0
        ? Math.min(privateBlues.blueScale, ftDivFix(FIXED_16_16_ONE, maxHeight))
        : privateBlues.blueScale;
    this.suppressesOvershoot = scale < blueScale;
    const boost = this.suppressesOvershoot
      ? Math.min(BOOST_AT_ZERO - ftMulDiv(BOOST_AT_ZERO, scale, blueScale), MAX_BOOST)
      : 0;
    for (const zone of zones) {
      const flat = ftMulFix(zone.csFlatEdge, scale);
      zone.dsFlatEdge = roundFixed(zone.isBottom ? flat - boost : flat + boost);
    }
    this.zones = zones;
  }

  /**
   * Whether a zone captures the stem's edges (`cf2_blues_capture`). If so, both edges move by the
   * same amount, to where the zone puts the captured one, and lock. At most one edge is in a
   * zone; a stem whose bottom is in a bottom zone and whose top is in a top zone moves by the
   * first zone found.
   */
  capture(bottom: HintEdge, top: HintEdge): boolean {
    for (const zone of this.zones) {
      const edge = zone.isBottom ? bottom : top;
      if (zone.isBottom ? !isBottomEdge(edge) : !isTopEdge(edge)) continue;
      if (zone.csBottomEdge - this.blueFuzz > edge.csCoord || edge.csCoord > zone.csTopEdge + this.blueFuzz)
        continue;
      const move = this.landing(zone, edge) - edge.dsCoord;
      for (const captured of [bottom, top]) {
        if (!isValidEdge(captured)) continue;
        captured.dsCoord += move;
        captured.flags |= EdgeFlag.Locked;
      }
      return true;
    }
    return false;
  }

  /** Where `zone` puts a captured `edge` in device space. */
  private landing(zone: Zone, edge: HintEdge): number {
    if (this.suppressesOvershoot) return zone.dsFlatEdge;
    if (zone.isBottom) {
      // A bottom edge at least BlueShift below the flat edge keeps a whole pixel of overshoot.
      return zone.csTopEdge - edge.csCoord >= this.blueShift
        ? Math.min(roundFixed(edge.dsCoord), zone.dsFlatEdge - FIXED_16_16_ONE)
        : roundFixed(edge.dsCoord);
    }
    return edge.csCoord - zone.csBottomEdge >= this.blueShift
      ? Math.max(roundFixed(edge.dsCoord), zone.dsFlatEdge + FIXED_16_16_ONE)
      : roundFixed(edge.dsCoord);
  }
}

/** An ideographic font whose zones are absent, or the two dummy ones Adobe tools write outside the em box. */
function hasEmBoxHeuristic({ languageGroup, blueValues }: PrivateBlues): boolean {
  if (languageGroup !== LANGUAGE_GROUP_IDEOGRAPHIC) return false;
  if (blueValues.length === 0) return true;
  const [bottomLow, bottomHigh, topLow, topHigh] = blueValues;
  return (
    blueValues.length === 4 &&
    bottomLow! < ICF_BOTTOM &&
    bottomHigh! < ICF_BOTTOM &&
    topLow! > ICF_TOP &&
    topHigh! > ICF_TOP
  );
}

/**
 * Ghost edges one counter beyond the em box, locked: they keep a glyph's extremes off the
 * pixel grid's edge, and give ideographic glyphs a net pixel of height.
 */
function emBoxEdgesAt(scale: number): { bottom: HintEdge; top: HintEdge } {
  /** A locked ghost edge at `csCoord`, `margin` pixels past the pixel it rounds to. */
  const ghostEdge = (flag: number, csCoord: number, margin: number): HintEdge => ({
    flags: flag | EdgeFlag.Locked | EdgeFlag.Synthetic,
    csCoord,
    dsCoord: roundFixed(ftMulFix(csCoord, scale)) + margin,
    scale,
    index: 0,
  });
  return {
    bottom: ghostEdge(EdgeFlag.GhostBottom, ICF_BOTTOM - EPSILON, -MIN_COUNTER),
    top: ghostEdge(EdgeFlag.GhostTop, ICF_TOP + EPSILON, MIN_COUNTER),
  };
}

/** The `BlueValues` and `OtherBlues` as zones, and the height of the tallest. A zone with its edges the wrong way round is dropped. */
function zonesOf({ blueValues, otherBlues }: PrivateBlues): { zones: Zone[]; maxHeight: number } {
  const zones: Zone[] = [];
  let maxHeight = 0;
  const add = (csBottomEdge: number, csTopEdge: number, isBottom: boolean) => {
    const height = csTopEdge - csBottomEdge;
    if (height < 0) return;
    maxHeight = Math.max(maxHeight, height);
    zones.push({
      csBottomEdge,
      csTopEdge,
      csFlatEdge: isBottom ? csTopEdge : csBottomEdge,
      dsFlatEdge: 0,
      isBottom,
    });
  };
  for (let i = 0; i < blueValues.length; i += 2) add(blueValues[i]!, blueValues[i + 1]!, i === 0);
  // The array can end on a lone value: the pair it starts reads a zero top edge, as FreeType does.
  for (let i = 0; i < otherBlues.length; i += 2) add(otherBlues[i]!, otherBlues[i + 1] ?? 0, true);
  return { zones, maxHeight };
}

/**
 * Moves each flat edge to the nearest Family zone's, if that is within a device pixel. A Family
 * zone sets the same edge across the fonts of a family, so their glyphs align alike.
 */
function snapToFamilyEdges(zones: Zone[], privateBlues: PrivateBlues, scale: number): void {
  const pixel = ftDivFix(FIXED_16_16_ONE, scale);
  const { familyBlues, familyOtherBlues } = privateBlues;
  for (const zone of zones) {
    const fontEdge = zone.csFlatEdge;
    let nearest = Number.MAX_SAFE_INTEGER;
    const consider = (familyEdge: number): boolean => {
      const gap = Math.abs(fontEdge - familyEdge);
      if (gap >= nearest || gap >= pixel) return false;
      zone.csFlatEdge = familyEdge;
      nearest = gap;
      return gap === 0;
    };
    // A bottom zone looks at the top edges of FamilyOtherBlues, then of FamilyBlues' first zone;
    // a top zone at the bottom edges of FamilyBlues' other zones.
    if (zone.isBottom) {
      for (let j = 0; j < familyOtherBlues.length; j += 2) if (consider(familyOtherBlues[j + 1] ?? 0)) break;
      if (familyBlues.length >= 2) consider(familyBlues[1]!);
    } else {
      for (let j = 2; j < familyBlues.length; j += 2) if (consider(familyBlues[j]!)) break;
    }
  }
}
