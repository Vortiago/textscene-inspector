/**
 * Moves the unlocked edges of a hint map onto the pixel grid. A stem moves as a whole, so its
 * width stays, and by the smaller of the moves that put either edge on a whole pixel. No edge
 * moves past its neighbour, or closer than a minimum counter.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { fractionOfFixed } from './cffFixed';
import { MIN_COUNTER, isLockedEdge, isPairEdge, type HintEdge } from './cffHintEdge';
import { FIXED_16_16_ONE, ftDivFix } from './fontMetrics';

/** An upward move that the first pass could not make, for the second pass to try again. */
interface DeferredMove {
  /** The index of the upper edge of the stem. */
  upper: number;
  moveUp: number;
}

/**
 * Adjusts `edges`, sorted by character space (`cf2_hintmap_adjustHints`), and sets each edge's
 * scale to the slope up to the next.
 *
 * The first pass goes upward, with the edges below already placed. A move down that is not the
 * best, or no move, is kept when an unlocked edge above could make room. The second pass goes
 * downward over those, and moves them up if there is room by then.
 */
export function adjustHints(edges: HintEdge[]): void {
  const deferred: DeferredMove[] = [];
  for (let i = 0; i < edges.length; i++) {
    const isPair = isPairEdge(edges[i]!);
    const upper = isPair ? i + 1 : i;
    if (!isLockedEdge(edges[i]!)) moveToGrid(edges, i, upper, deferred);
    setSlopeBelow(edges, i);
    if (isPair) {
      setSlopeBelow(edges, upper);
      i++;
    }
  }
  for (let k = deferred.length - 1; k >= 0; k--) {
    const { upper, moveUp } = deferred[k]!;
    if (edges[upper + 1]!.dsCoord >= edges[upper]!.dsCoord + moveUp + MIN_COUNTER) {
      edges[upper]!.dsCoord += moveUp;
      if (isPairEdge(edges[upper]!)) edges[upper - 1]!.dsCoord += moveUp;
    }
  }
}

/** Moves the unlocked edge `lower`, with the stem up to `upper`, the least that puts one of them on a whole pixel. */
function moveToGrid(edges: HintEdge[], lower: number, upper: number, deferred: DeferredMove[]): void {
  const lowerDs = edges[lower]!.dsCoord;
  const upperDs = edges[upper]!.dsCoord;
  const fractionOfLower = fractionOfFixed(lowerDs);
  const fractionOfUpper = fractionOfFixed(upperDs);
  // Moves down are negative. The smallest move up and the smallest move down are the best of each.
  const moveUp = Math.min(upMove(fractionOfLower), upMove(fractionOfUpper));
  const moveDown = Math.max(-fractionOfLower, -fractionOfUpper);

  const hasRoomUp = upper >= edges.length - 1 || edges[upper + 1]!.dsCoord >= upperDs + moveUp + MIN_COUNTER;
  const hasRoomDown = lower === 0 || edges[lower - 1]!.dsCoord <= lowerDs + moveDown - MIN_COUNTER;

  let move = 0;
  let isWorse = false;
  if (hasRoomUp) {
    // With room down too, the smaller move wins; without it, up is the only way.
    move = hasRoomDown && -moveDown < moveUp ? moveDown : moveUp;
  } else if (hasRoomDown) {
    move = moveDown;
    isWorse = moveUp < -moveDown;
  } else {
    isWorse = true;
  }

  if (isWorse && upper < edges.length - 1 && !isLockedEdge(edges[upper + 1]!)) {
    deferred.push({ upper, moveUp: moveUp - move });
  }
  edges[lower]!.dsCoord = lowerDs + move;
  if (upper !== lower) edges[upper]!.dsCoord = upperDs + move;
}

/** The move up to the next whole pixel, none from one. */
function upMove(fraction: number): number {
  return fraction === 0 ? 0 : FIXED_16_16_ONE - fraction;
}

/** Sets the scale of the edge below `index` to the slope between the two, unless they share a character space position. */
function setSlopeBelow(edges: HintEdge[], index: number): void {
  const below = edges[index - 1];
  const edge = edges[index]!;
  if (below && edge.csCoord !== below.csCoord) {
    below.scale = ftDivFix(edge.dsCoord - below.dsCoord, edge.csCoord - below.csCoord);
  }
}
