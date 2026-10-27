/**
 * Draws the moves, lines and curves of a charstring into device space: x is scaled, and y goes
 * through the hint map. The map changes between path elements when the charstring's hint mask
 * does, so a path element waits one call in a queue until the map for its end is known. This is
 * FreeType's `cf2_glyphpath` without stem darkening, where every offset is zero and an element's
 * end meets the next one's start.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { BlueZones } from './cffBlues';
import type { GlyphHints, HintMask } from './cffGlyphHints';
import { HintMap } from './cffHintMap';
import type { DevicePen } from './cffPen';
import { ftMulFix } from './fontMetrics';

/** What waits in the queue. */
const QUEUED_NONE = 0;
const QUEUED_LINE = 1;
const QUEUED_CURVE = 2;

/** Where the end of a queued element sits in `GlyphPath.queued`. */
const END_X = 4;
const END_Y = 5;

export class GlyphPath {
  private readonly initialMap: HintMap;
  private hintMap: HintMap;
  /** The map in force when the contour began, which draws the line that closes it. */
  private firstHintMap: HintMap;
  /** The scale from character space to device space, which places x. */
  private readonly scale: number;
  /** A contour's start and the point drawn last, in character space. The path starts at the origin whatever the charstring's first move says. */
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private currentDeviceX = 0;
  private currentDeviceY = 0;
  /**
   * The element waiting to be drawn, with its points in character space: three x, y pairs for a
   * curve and only the last pair for a line. Written by `queue`, which fills it with no allocation.
   */
  private readonly queued = new Float64Array(6);
  private queuedKind = QUEUED_NONE;
  private isMovePending = true;
  private isClosing = false;

  /** `hintOrigin` is the y where a `seac` accent starts, which the stems of the accent are relative to. */
  constructor(
    private readonly pen: DevicePen,
    private readonly hints: GlyphHints,
    private readonly blues: BlueZones,
    private readonly hintOrigin: number
  ) {
    this.scale = blues.scale;
    this.initialMap = new HintMap(blues);
    this.hintMap = new HintMap(blues, this.initialMap);
    this.firstHintMap = this.hintMap.clone();
  }

  moveTo(x: number, y: number): void {
    this.closeOpenPath();
    this.startX = this.currentX = x;
    this.startY = this.currentY = y;
    this.isMovePending = true;
    if (!this.hintMap.isValid || this.hints.mask.isNew) this.buildHintMap();
    this.firstHintMap = this.hintMap.clone();
  }

  /** A line of zero length adds nothing, unless a new hint mask begins here: its end then lands elsewhere. */
  lineTo(x: number, y: number): void {
    const startsNewMap = this.hints.mask.isNew && !this.isClosing;
    if (this.currentX === x && this.currentY === y && !startsNewMap) return;
    this.drawQueued();
    this.queued[END_X] = x;
    this.queued[END_Y] = y;
    this.queuedKind = QUEUED_LINE;
    if (startsNewMap) this.buildHintMap();
    this.currentX = x;
    this.currentY = y;
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.drawQueued();
    this.queued.set([x1, y1, x2, y2, x3, y3]);
    this.queuedKind = QUEUED_CURVE;
    if (this.hints.mask.isNew) this.buildHintMap();
    this.currentX = x3;
    this.currentY = y3;
  }

  /** Ends the open contour with a line back to its start (`cf2_glyphpath_closeOpenPath`). */
  closeOpenPath(): void {
    if (this.isMovePending) return;
    this.isClosing = true;
    this.lineTo(this.startX, this.startY);
    if (this.queuedKind !== QUEUED_NONE) {
      this.draw(this.hintMap, this.startX, this.startY, this.firstHintMap);
    }
    this.isMovePending = true;
    this.isClosing = false;
    this.queuedKind = QUEUED_NONE;
  }

  /**
   * Places and locks the stems of a counter mask (`cntrmask`) on a map of their own, so that the
   * stems of one counter group keep together when hint groups later pull them apart.
   */
  lockCounterStems(counterMask: HintMask): void {
    new HintMap(this.blues, this.initialMap).build(this.hints, counterMask, 0);
  }

  /** Starts a contour if a move waits, then draws the element in the queue, which the caller then refills. */
  private drawQueued(): void {
    if (this.isMovePending) {
      this.startContour();
      this.isMovePending = false;
    }
    if (this.queuedKind !== QUEUED_NONE) this.draw(this.hintMap, this.currentX, this.currentY, this.hintMap);
  }

  private startContour(): void {
    // A path with no move at all synthesizes one at the origin, which also builds the first map.
    if (!this.hintMap.isValid) this.moveTo(this.startX, this.startY);
    this.currentDeviceX = ftMulFix(this.currentX, this.scale);
    this.currentDeviceY = this.hintMap.map(this.currentY);
    this.pen.moveTo(this.currentDeviceX, this.currentDeviceY);
  }

  /**
   * Draws the queued element, then a line to `(nextX, nextY)` if the element does not end there.
   * `map` places a curve. `endMap` places the end of a line and the next point: it differs from
   * `map` only for the element that closes a contour, which ends where the contour began, by the map
   * it began with.
   */
  private draw(map: HintMap, nextX: number, nextY: number, endMap: HintMap): void {
    const { queued } = this;
    if (this.queuedKind === QUEUED_LINE) {
      this.lineToDevice(ftMulFix(queued[END_X]!, this.scale), endMap.map(queued[END_Y]!));
    } else {
      const endX = ftMulFix(queued[END_X]!, this.scale);
      const endY = map.map(queued[END_Y]!);
      this.pen.curveTo(
        ftMulFix(queued[0]!, this.scale),
        map.map(queued[1]!),
        ftMulFix(queued[2]!, this.scale),
        map.map(queued[3]!),
        endX,
        endY
      );
      this.currentDeviceX = endX;
      this.currentDeviceY = endY;
    }
    // The same end placed by the same map is where the pen already is.
    const endsAtNext = nextX === queued[END_X] && nextY === queued[END_Y];
    if (endsAtNext && (this.queuedKind === QUEUED_LINE || endMap === map)) return;
    this.lineToDevice(ftMulFix(nextX, this.scale), endMap.map(nextY));
  }

  private lineToDevice(x: number, y: number): void {
    if (x === this.currentDeviceX && y === this.currentDeviceY) return;
    this.pen.lineTo(x, y);
    this.currentDeviceX = x;
    this.currentDeviceY = y;
  }

  private buildHintMap(): void {
    this.hintMap.build(this.hints, this.hints.mask, this.hintOrigin);
  }
}
