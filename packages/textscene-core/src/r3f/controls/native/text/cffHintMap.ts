/**
 * The map from a character space y to a device space y that a charstring's hints define: a
 * piecewise linear function through the stem edges, each moved onto the pixel grid. A glyph has an
 * initial map of the edges its blue zones capture, and a map for each hint mask, which uses the
 * initial one to place the stems no zone captures.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { BlueZones } from './cffBlues';
import { adjustHints } from './cffHintAdjust';
import {
  EdgeFlag,
  isLockedEdge,
  isPairTopEdge,
  isSyntheticEdge,
  isTopEdge,
  isValidEdge,
  noEdge,
  stemEdge,
  type HintEdge,
  type StemHint,
} from './cffHintEdge';
import { HintMask, MAX_STEMS, type GlyphHints } from './cffGlyphHints';
import { ftMulFix } from './fontMetrics';

/** `CF2_MAX_HINT_EDGES`: two edges for each of the most stems a mask holds. */
const MAX_EDGES = 2 * MAX_STEMS;

export class HintMap {
  /** True once built: until then a map is empty, and the glyph path builds it at its first move. */
  isValid = false;
  private edges: HintEdge[] = [];
  /** The map of the captured edges. The initial map is its own. */
  private readonly initialMap: HintMap;

  constructor(
    private readonly blues: BlueZones,
    initialMap?: HintMap
  ) {
    this.initialMap = initialMap ?? this;
  }

  /** The scale of the font size, which places an edge no hint moves. */
  private get scale(): number {
    return this.blues.scale;
  }

  clone(): HintMap {
    const copy = new HintMap(this.blues, this.initialMap);
    copy.isValid = this.isValid;
    // A built map never changes its edges, so a clone shares them: `build` replaces the array.
    copy.edges = this.edges;
    return copy;
  }

  /** The device space y of character space `y` (`cf2_hintmap_map`). */
  map(y: number): number {
    const { edges } = this;
    if (edges.length === 0) return ftMulFix(y, this.scale);
    // The highest edge at or below y, so an edge that shares a position with another uses the upper one.
    let i = 0;
    while (i < edges.length - 1 && y >= edges[i + 1]!.csCoord) i++;
    const edge = edges[i]!;
    // Below the first edge, the font's own scale applies.
    return y < edges[0]!.csCoord
      ? ftMulFix(y - edge.csCoord, this.scale) + edge.dsCoord
      : ftMulFix(y - edge.csCoord, edge.scale) + edge.dsCoord;
  }

  /**
   * Builds the map for the stems `mask` turns on (`cf2_hintmap_build`). The edges a blue zone
   * captures, or an earlier map placed, go in first and lock; the rest go in after, but not in the
   * initial map. `mask` is changed when a glyph has none: all its stems are on. `hintOrigin` moves
   * the stems of a `seac` accent.
   */
  build(hints: GlyphHints, mask: HintMask, hintOrigin: number): void {
    const isInitial = this.initialMap === this;
    if (!isInitial && !this.initialMap.isValid) {
      this.initialMap.build(hints, new HintMask(), hintOrigin);
    }
    if (!mask.isValid) mask.setAll(hints.stemCount);

    this.edges = [];
    const stems = hints.horizontalStems;
    if (stems.length > mask.bitCount) return;
    // The edges of each stem the mask turns on, which the map owns once it takes them in.
    const pending = stems.map((stem, i): [HintEdge, HintEdge] | null =>
      mask.isOn(i)
        ? [stemEdge(stem, i, true, hintOrigin, this.scale), stemEdge(stem, i, false, hintOrigin, this.scale)]
        : null
    );

    // Ghost hints at the em box get the highest priority. The zones share theirs, so the map takes copies.
    if (this.blues.emBoxEdges) {
      this.insert({ ...this.blues.emBoxEdges.bottom }, noEdge());
      this.insert(noEdge(), { ...this.blues.emBoxEdges.top });
    }
    for (let i = 0; i < stems.length; i++) {
      const edges = pending[i];
      if (!edges) continue;
      const [bottom, top] = edges;
      if (isLockedEdge(bottom) || isLockedEdge(top) || this.blues.capture(bottom, top)) {
        this.insert(bottom, top);
        pending[i] = null;
      }
    }

    if (isInitial) {
      this.lockBaselineWhenUncovered();
    } else {
      for (const edges of pending) {
        if (edges) this.insert(...edges);
      }
    }

    adjustHints(this.edges);
    if (!isInitial) this.rememberPlaces(stems);
    this.isValid = true;
    mask.isNew = false;
  }

  /** A locked ghost edge at 0, unless an edge is on each side of it: a glyph with no baseline hint keeps its baseline. */
  private lockBaselineWhenUncovered(): void {
    const { edges } = this;
    if (edges.length > 0 && edges[0]!.csCoord <= 0 && edges[edges.length - 1]!.csCoord >= 0) return;
    const baseline: HintEdge = {
      ...noEdge(),
      flags: EdgeFlag.GhostBottom | EdgeFlag.Locked | EdgeFlag.Synthetic,
      scale: this.scale,
    };
    this.insert(baseline, noEdge());
  }

  /** Saves where each stem landed, so a later map that uses the stem puts it in the same place. */
  private rememberPlaces(stems: StemHint[]): void {
    for (const edge of this.edges) {
      if (isSyntheticEdge(edge)) continue;
      const stem = stems[edge.index]!;
      if (isTopEdge(edge)) stem.maxDS = edge.dsCoord;
      else stem.minDS = edge.dsCoord;
      stem.used = true;
    }
  }

  /**
   * Inserts the stem's edges in order of character space (`cf2_hintmap_insertHint`), unless they
   * overlap one already there, in either space. One of the two may be no edge, for a ghost.
   */
  private insert(bottom: HintEdge, top: HintEdge): void {
    const isPair = isValidEdge(bottom) && isValidEdge(top);
    const first = isValidEdge(bottom) ? bottom : top;
    if (isPair && top.csCoord < bottom.csCoord) return;

    const { edges } = this;
    // Indexed, not `findIndex`: no closure per insert.
    let at = 0;
    while (at < edges.length && edges[at]!.csCoord < first.csCoord) at++;
    const next = edges[at];
    if (next) {
      if (next.csCoord === first.csCoord) return;
      if (isPair && next.csCoord <= top.csCoord) return;
      if (isPairTopEdge(next)) return;
    }

    if (this.initialMap.isValid && !isLockedEdge(first)) this.placeByInitialMap(first, isPair ? top : null);

    const last = isPair ? top : first;
    if (at > 0 && first.dsCoord < edges[at - 1]!.dsCoord) return;
    if (next && last.dsCoord > next.dsCoord) return;
    if (edges.length + (isPair ? 1 : 0) >= MAX_EDGES) return;
    if (isPair) edges.splice(at, 0, first, top);
    else edges.splice(at, 0, first);
  }

  /**
   * Puts an unlocked stem where the initial map puts it: its centre by the map, its two edges
   * apart by the font's scale so that the width stays. A single edge goes where the map puts it.
   */
  private placeByInitialMap(first: HintEdge, second: HintEdge | null): void {
    const initial = this.initialMap;
    if (!second) {
      first.dsCoord = initial.map(first.csCoord);
      return;
    }
    const halfWidth = Math.trunc((second.csCoord - first.csCoord) / 2);
    const centre = initial.map(first.csCoord + halfWidth);
    const halfWidthDs = ftMulFix(halfWidth, this.scale);
    first.dsCoord = centre - halfWidthDs;
    second.dsCoord = centre + halfWidthDs;
  }
}
