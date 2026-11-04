/**
 * The Latin writing system's hinting of one glyph (`aflatin.c`): it fits the edges of each axis to
 * the pixel grid, blue edges first, then stems from an anchor, then serifs and lone edges, and moves
 * the points with their edges. Godot loads glyphs for the normal target, so this is the normal
 * mode's path: stems adjust, and no axis snaps its stems.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ScaledOutline } from '../glyphContours';
import { ftMulDiv, pixRound } from '../fontMetrics';
import { GlyphStyle } from './afFace';
import {
  alignEdgePoints,
  alignStrongPoints,
  alignWeakPoints,
  Dimension,
  divide,
  EdgeFlag,
  reloadHints,
  saveHints,
  ScalerFlag,
  type DimensionValue,
  type Edge,
  type GlyphHints,
} from './afHints';
import { adjustDiacritics, applyVerticalSeparation, type DiacriticAdjustment } from './afDiacritics';
import { computeBlueEdges, computeEdges, computeSegments, linkSegments } from './afLatinFeatures';
import type { LatinMetrics } from './afLatinMetrics';
import { AUTOFIT_SCRIPTS } from './afScripts';

/** `af_latin_hints_init`: the scales of the hints, with no horizontal hinting for an italic face. */
export function initLatinHints(hints: GlyphHints, metrics: LatinMetrics): void {
  const [horizontal, vertical] = metrics.axis;
  hints.xScale = horizontal.scale;
  hints.xDelta = horizontal.delta;
  hints.yScale = vertical.scale;
  hints.yDelta = vertical.delta;
  hints.scalerFlags = metrics.globals.face.isItalic ? ScalerFlag.NO_HORIZONTAL : 0;
}

/** Stems narrower than this, in 1/64 px, keep their width; a round edge's stem of less grows to 1 px. */
const ROUND_STEM_MIN = 80;
const STRAIGHT_STEM_MIN = 56;

/** The fitted width of a stem 3 px or narrower: whole pixels plus a fraction rounded to 0, 10/64, 54/64 or as it is. */
function smallStemWidth(dist: number): number {
  const fraction = dist & 63;
  const whole = dist & -64;
  if (fraction < 10) return whole + fraction;
  if (fraction < 32) return whole + 10;
  if (fraction < 54) return whole + 54;
  return whole + fraction;
}

/**
 * `af_latin_compute_stem_width` in normal mode: the fitted width of a stem `width` wide between
 * edges of `baseFlags` and `stemFlags`. A stem near the axis's standard width takes it.
 */
function stemWidth(
  metrics: LatinMetrics,
  dim: DimensionValue,
  width: number,
  baseDelta: number,
  baseFlags: number,
  stemFlags: number
): number {
  const axis = metrics.axis[dim];
  if (axis.isExtraLight) return width;
  const isVertical = dim === Dimension.VERT;
  let dist = Math.abs(width);
  const sign = width < 0 ? -1 : 1;
  if (stemFlags & EdgeFlag.SERIF && isVertical && dist < 3 * 64) return sign * dist;
  if (baseFlags & EdgeFlag.ROUND) {
    if (dist < ROUND_STEM_MIN) dist = 64;
  } else if (dist < STRAIGHT_STEM_MIN) dist = STRAIGHT_STEM_MIN;
  const standard = axis.widths[0];
  if (standard) {
    if (Math.abs(dist - standard.cur) < 40) return sign * Math.max(standard.cur, 48);
    if (dist < 3 * 64) dist = smallStemWidth(dist);
    else dist = (dist - baseDeltaShift(width, baseDelta, metrics.scaler.ppem) + 32) & ~63;
  }
  return sign * dist;
}

/** The part of the base edge's move a wide stem gives back below 30 ppem, all of it below 10. */
function baseDeltaShift(width: number, baseDelta: number, ppem: number): number {
  if (!((width > 0 && baseDelta > 0) || (width < 0 && baseDelta < 0))) return 0;
  if (ppem < 10) return Math.abs(baseDelta);
  if (ppem < 30) return Math.abs(divide(baseDelta * (30 - ppem), 20));
  return 0;
}

/** `af_latin_align_linked_edge`: `stem` moves to its fitted width from `base`. */
function alignLinkedEdge(metrics: LatinMetrics, dim: DimensionValue, base: Edge, stem: Edge): void {
  const width = stemWidth(metrics, dim, stem.opos - base.opos, base.pos - base.opos, base.flags, stem.flags);
  stem.pos = base.pos + width;
}

/** Whether an edge's position runs against the order of the edges, as hinting from the top reverses it. */
const isOutOfOrder = (pos: number, before: number, isTopToBottom: boolean): boolean =>
  isTopToBottom ? pos > before : pos < before;

/** The two offsets of a narrow stem's centre from the pixel centre it rounds to: below 1 px, or between 1 and 1.5 px. */
const centreOffsets = (width: number): [up: number, down: number] => (width <= 64 ? [32, 32] : [38, 26]);

/** The centre of a stem under 1.5 px wide, moved to the nearer of its two offsets from the pixel centre. */
function narrowStemCentre(centre: number, width: number): number {
  const [up, down] = centreOffsets(width);
  const rounded = pixRound(centre);
  return Math.abs(centre - (rounded - up)) < Math.abs(centre - (rounded + down))
    ? rounded - up
    : rounded + down;
}

/** The blue edges of the vertical axis go onto their zones, and the edge each links to follows. Returns the anchor. */
function hintBlueEdges(metrics: LatinMetrics, edges: readonly Edge[]): Edge | null {
  let anchor: Edge | null = null;
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    let edge2 = edge.link;
    if (edge.blueEdge && edge2?.blueEdge) {
      if (edge2.flags & EdgeFlag.NEUTRAL) {
        edge2.blueEdge = null;
        edge2.flags &= ~EdgeFlag.NEUTRAL;
      } else if (edge.flags & EdgeFlag.NEUTRAL) {
        edge.blueEdge = null;
        edge.flags &= ~EdgeFlag.NEUTRAL;
      }
    }
    let blue = edge.blueEdge;
    let edge1: Edge | null = null;
    if (blue) edge1 = edge;
    else if (edge2?.blueEdge) {
      blue = edge2.blueEdge;
      edge1 = edge2;
      edge2 = edge;
    }
    if (!edge1 || !blue) continue;
    edge1.pos = blue.fit;
    edge1.flags |= EdgeFlag.DONE;
    if (edge2 && !edge2.blueEdge) {
      alignLinkedEdge(metrics, Dimension.VERT, edge1, edge2);
      edge2.flags |= EdgeFlag.DONE;
    }
    anchor ??= edge;
  }
  return anchor;
}

/** The first stem, with no anchor yet, rounds on its own and becomes the anchor. */
function hintFirstStem(metrics: LatinMetrics, dim: DimensionValue, edge: Edge, edge2: Edge): void {
  const orgLength = edge2.opos - edge.opos;
  const width = stemWidth(metrics, dim, orgLength, 0, edge.flags, edge2.flags);
  if (width < 96) {
    const centre = narrowStemCentre(edge.opos + (orgLength >> 1), width);
    edge.pos = centre - divide(width, 2);
    edge2.pos = edge.pos + width;
  } else edge.pos = pixRound(edge.opos);
  edge.flags |= EdgeFlag.DONE;
  alignLinkedEdge(metrics, dim, edge, edge2);
}

/** A later stem keeps its place relative to the anchor, rounded to the grid at its fitted width. */
function hintStem(metrics: LatinMetrics, dim: DimensionValue, anchor: Edge, edge: Edge, edge2: Edge): void {
  const orgPos = anchor.pos + (edge.opos - anchor.opos);
  const orgLength = edge2.opos - edge.opos;
  const orgCentre = orgPos + (orgLength >> 1);
  const width = stemWidth(metrics, dim, orgLength, 0, edge.flags, edge2.flags);
  if (edge2.flags & EdgeFlag.DONE) edge.pos = edge2.pos - width;
  else if (width < 96) {
    const centre = narrowStemCentre(orgCentre, width);
    edge.pos = centre - divide(width, 2);
    edge2.pos = centre + divide(width, 2);
  } else {
    const pos1 = pixRound(orgPos);
    const delta1 = Math.abs(pos1 + (width >> 1) - orgCentre);
    const pos2 = pixRound(orgPos + orgLength) - width;
    const delta2 = Math.abs(pos2 + (width >> 1) - orgCentre);
    edge.pos = delta1 < delta2 ? pos1 : pos2;
    edge2.pos = edge.pos + width;
  }
  edge.flags |= EdgeFlag.DONE;
  edge2.flags |= EdgeFlag.DONE;
}

/** An edge that ends up before the one before it moves back onto it, when its link is far from that one. */
function keepOrderAfter(edges: readonly Edge[], edge: Edge, isTopToBottom: boolean): void {
  const before = edges[edge.index - 1];
  if (!before || !isOutOfOrder(edge.pos, before.pos, isTopToBottom)) return;
  if (edge.link && Math.abs(edge.link.pos - before.pos) > 16) edge.pos = before.pos;
}

/**
 * Three stems equally spaced, as in "m", stay equally spaced: the third moves to match the first
 * two when they are 6 or 12 edges and the spacings differ by less than 8 units.
 */
function keepStemSpacing(edges: readonly Edge[]): void {
  const count = edges.length;
  if (count !== 6 && count !== 12) return;
  const [edge1, edge2, edge3] = (count === 6 ? [0, 2, 4] : [1, 5, 9]).map((index) => edges[index]!) as [
    Edge,
    Edge,
    Edge,
  ];
  const span = Math.abs(edge2.opos - edge1.opos - (edge3.opos - edge2.opos));
  if (span >= 8) return;
  const delta = edge3.pos - (2 * edge2.pos - edge1.pos);
  edge3.pos -= delta;
  if (edge3.link) edge3.link.pos -= delta;
  if (count === 12) {
    edges[8]!.pos -= delta;
    edges[11]!.pos -= delta;
  }
  edge3.flags |= EdgeFlag.DONE;
  if (edge3.link) edge3.link.flags |= EdgeFlag.DONE;
}

/** The lowest and highest cross-axis coordinate of the end points of an edge's first and last segments. */
function crossExtent(edge: Edge): [min: number, max: number] {
  const values = [edge.first.first.v, edge.first.last.v, edge.last.first.v, edge.last.last.v];
  return [Math.min(...values), Math.max(...values)];
}

/**
 * The distance from an edge to its serif, or 1000 for none, or for a serif whose span another
 * edge between them crosses, which FreeType hints as a lone edge.
 */
function serifDistance(edges: readonly Edge[], edge: Edge): number {
  if (!edge.serif) return 1000;
  let delta = edge.serif.opos - edge.opos;
  const [top, bottom] = delta < 0 ? [edge, edge.serif] : [edge.serif, edge];
  delta = Math.abs(delta);
  if (delta >= 64 + 32) return delta;
  const [topMin, topMax] = crossExtent(top);
  const [bottomMin, bottomMax] = crossExtent(bottom);
  const minPos = Math.min(topMin, bottomMin);
  const maxPos = Math.max(topMax, bottomMax);
  for (let index = bottom.index + 1; index < top.index; index++) {
    const [eMin, eMax] = crossExtent(edges[index]!);
    if (!((eMin < minPos && eMax < minPos) || (eMin > maxPos && eMax > maxPos))) return 1000;
  }
  return delta;
}

/** The nearest done edges before and after `edge`, or null at either end. */
function doneNeighbours(edges: readonly Edge[], edge: Edge): [Edge | null, Edge | null] {
  let before: Edge | null = null;
  for (let index = edge.index - 1; index >= 0 && !before; index--)
    if (edges[index]!.flags & EdgeFlag.DONE) before = edges[index]!;
  let after: Edge | null = null;
  for (let index = edge.index + 1; index < edges.length && !after; index++)
    if (edges[index]!.flags & EdgeFlag.DONE) after = edges[index]!;
  return [before, after];
}

/**
 * The edges no stem holds: a serif follows its base, the first lone edge rounds and anchors, and
 * the rest move in proportion between the done edges around them. Returns the anchor.
 */
function hintLoneEdges(edges: readonly Edge[], anchor: Edge | null, isTopToBottom: boolean): void {
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    const delta = serifDistance(edges, edge);
    if (edge.serif && delta === 1000) continue;
    if (delta < 64 + 16) edge.pos = edge.serif!.pos + (edge.opos - edge.serif!.opos);
    else if (!anchor) {
      edge.pos = pixRound(edge.opos);
      anchor = edge;
    } else {
      const [before, after] = doneNeighbours(edges, edge);
      if (before && after)
        edge.pos =
          after.opos === before.opos
            ? before.pos
            : before.pos +
              ftMulDiv(edge.opos - before.opos, after.pos - before.pos, after.opos - before.opos);
      else edge.pos = anchor.pos + ((edge.opos - anchor.opos + 16) & ~31);
    }
    edge.flags |= EdgeFlag.DONE;
    keepOrderAfter(edges, edge, isTopToBottom);
    keepOrderBefore(edges, edge, isTopToBottom);
  }
}

/**
 * An edge past the done edge after it moves onto that edge. FreeType tests the link against the
 * edge before, so the first edge, which has none, stays.
 */
function keepOrderBefore(edges: readonly Edge[], edge: Edge, isTopToBottom: boolean): void {
  const after = edges[edge.index + 1];
  const before = edges[edge.index - 1];
  if (!after || !(after.flags & EdgeFlag.DONE) || !isOutOfOrder(after.pos, edge.pos, isTopToBottom)) return;
  if (before && edge.link && Math.abs(edge.link.pos - before.pos) > 16) edge.pos = after.pos;
}

/** `af_latin_hint_edges`: fits the edges of `dim` to the pixel grid. */
function hintEdges(hints: GlyphHints, metrics: LatinMetrics, dim: DimensionValue): void {
  const { edges } = hints.axis[dim];
  const isTopToBottom = dim === Dimension.VERT && AUTOFIT_SCRIPTS[metrics.style.script]!.isTopToBottom;
  let anchor = dim === Dimension.VERT ? hintBlueEdges(metrics, edges) : null;
  let hasLoneEdges = false;
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    const edge2 = edge.link;
    if (!edge2) {
      hasLoneEdges = true;
      continue;
    }
    if (edge2.blueEdge) {
      alignLinkedEdge(metrics, dim, edge2, edge);
      edge.flags |= EdgeFlag.DONE;
      continue;
    }
    if (!anchor) {
      hintFirstStem(metrics, dim, edge, edge2);
      anchor = edge;
      continue;
    }
    hintStem(metrics, dim, anchor, edge, edge2);
    keepOrderAfter(edges, edge, isTopToBottom);
  }
  if (dim === Dimension.HORZ) keepStemSpacing(edges);
  if (hasLoneEdges || !anchor) hintLoneEdges(edges, anchor, isTopToBottom);
}

/** Hints the points of `dim`: edges, then the points on them, then the strong and the weak points. */
function hintAxis(
  hints: GlyphHints,
  metrics: LatinMetrics,
  dim: DimensionValue,
  adjustment: DiacriticAdjustment
): void {
  hintEdges(hints, metrics, dim);
  alignEdgePoints(hints, dim);
  alignStrongPoints(hints, dim);
  alignWeakPoints(hints, dim);
  if (dim === Dimension.VERT) applyVerticalSeparation(hints, adjustment);
}

/** `af_latin_hints_apply`: hints `outline`, which holds `glyph` in font units, in place. */
export function applyLatinHints(
  glyph: number,
  hints: GlyphHints,
  outline: ScaledOutline,
  metrics: LatinMetrics
): void {
  reloadHints(hints, outline);
  const doesHorizontal = !(hints.scalerFlags & ScalerFlag.NO_HORIZONTAL);
  const doesVertical = !(hints.scalerFlags & ScalerFlag.NO_VERTICAL);
  const [horizontal, vertical] = metrics.axis;
  if (doesHorizontal)
    detectFeatures(hints, metrics, Dimension.HORZ, horizontal.widths, horizontal.edgeDistanceThreshold);
  let adjustment: DiacriticAdjustment = { codePointFlags: 0, accentHeightLimit: 0 };
  if (doesVertical) {
    adjustment = adjustDiacritics(hints, metrics, glyph, () =>
      detectFeatures(hints, metrics, Dimension.VERT, vertical.widths, vertical.edgeDistanceThreshold)
    );
    if (!(metrics.globals.glyphStyles[glyph]! & GlyphStyle.NONBASE))
      computeBlueEdges(hints, vertical.blues, vertical.scale);
  }
  if (doesHorizontal) hintAxis(hints, metrics, Dimension.HORZ, adjustment);
  if (doesVertical) hintAxis(hints, metrics, Dimension.VERT, adjustment);
  saveHints(hints, outline);
}

/** `af_latin_hints_detect_features`: the segments, links and edges of `dim`. */
function detectFeatures(
  hints: GlyphHints,
  metrics: LatinMetrics,
  dim: DimensionValue,
  widths: LatinMetrics['axis'][0]['widths'],
  edgeDistanceThreshold: number
): void {
  computeSegments(hints, dim);
  linkSegments(hints, dim, widths);
  computeEdges(
    hints,
    dim,
    edgeDistanceThreshold,
    dim === Dimension.VERT && AUTOFIT_SCRIPTS[metrics.style.script]!.isTopToBottom
  );
}
