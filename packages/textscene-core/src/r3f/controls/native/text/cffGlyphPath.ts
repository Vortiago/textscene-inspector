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

interface Point {
  x: number;
  y: number;
}

/** The element waiting to be drawn, with its points in character space. */
type QueuedElement =
  { kind: 'line'; end: Point } | { kind: 'curve'; first: Point; second: Point; end: Point };

export class GlyphPath {
  private readonly initialMap: HintMap;
  private hintMap: HintMap;
  /** The map in force when the contour began, which draws the line that closes it. */
  private firstHintMap: HintMap;
  /** A contour's start and the point drawn last, in character space. The path starts at the origin whatever the charstring's first move says. */
  private start: Point = { x: 0, y: 0 };
  private current: Point = { x: 0, y: 0 };
  private currentDevice: Point = { x: 0, y: 0 };
  private queued: QueuedElement | null = null;
  private isMovePending = true;
  private isClosing = false;

  /** `hintOrigin` is the y where a `seac` accent starts, which the stems of the accent are relative to. */
  constructor(
    private readonly pen: DevicePen,
    private readonly hints: GlyphHints,
    private readonly blues: BlueZones,
    private readonly hintOrigin: number
  ) {
    this.initialMap = new HintMap(blues);
    this.hintMap = new HintMap(blues, this.initialMap);
    this.firstHintMap = this.hintMap.clone();
  }

  moveTo(x: number, y: number): void {
    this.closeOpenPath();
    this.start = { x, y };
    this.current = { x, y };
    this.isMovePending = true;
    if (!this.hintMap.isValid || this.hints.mask.isNew) this.buildHintMap();
    this.firstHintMap = this.hintMap.clone();
  }

  /** A line of zero length adds nothing, unless a new hint mask begins here: its end then lands elsewhere. */
  lineTo(x: number, y: number): void {
    const startsNewMap = this.hints.mask.isNew && !this.isClosing;
    if (this.current.x === x && this.current.y === y && !startsNewMap) return;
    this.queue({ kind: 'line', end: { x, y } });
    if (startsNewMap) this.buildHintMap();
    this.current = { x, y };
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.queue({ kind: 'curve', first: { x: x1, y: y1 }, second: { x: x2, y: y2 }, end: { x: x3, y: y3 } });
    if (this.hints.mask.isNew) this.buildHintMap();
    this.current = { x: x3, y: y3 };
  }

  /** Ends the open contour with a line back to its start (`cf2_glyphpath_closeOpenPath`). */
  closeOpenPath(): void {
    if (this.isMovePending) return;
    this.isClosing = true;
    this.lineTo(this.start.x, this.start.y);
    if (this.queued) this.draw(this.queued, this.hintMap, this.start, this.firstHintMap);
    this.isMovePending = true;
    this.isClosing = false;
    this.queued = null;
  }

  /**
   * Places and locks the stems of a counter mask (`cntrmask`) on a map of their own, so that the
   * stems of one counter group keep together when hint groups later pull them apart.
   */
  lockCounterStems(counterMask: HintMask): void {
    new HintMap(this.blues, this.initialMap).build(this.hints, counterMask, 0);
  }

  /** Starts a contour if a move waits, then draws the element in the queue and queues `element`. */
  private queue(element: QueuedElement): void {
    if (this.isMovePending) {
      this.startContour();
      this.isMovePending = false;
    }
    if (this.queued) this.draw(this.queued, this.hintMap, this.current, this.hintMap);
    this.queued = element;
  }

  private startContour(): void {
    // A path with no move at all synthesizes one at the origin, which also builds the first map.
    if (!this.hintMap.isValid) this.moveTo(this.start.x, this.start.y);
    this.currentDevice = this.devicePoint(this.hintMap, this.current);
    this.pen.moveTo(this.currentDevice.x, this.currentDevice.y);
  }

  /**
   * Draws `element`, then a line to `next` if the element does not end there. `map` places a
   * curve. `endMap` places the end of a line and `next`: it differs from `map` only for the
   * element that closes a contour, which ends where the contour began, by the map it began with.
   */
  private draw(element: QueuedElement, map: HintMap, next: Point, endMap: HintMap): void {
    if (element.kind === 'line') {
      this.lineToDevice(this.devicePoint(endMap, element.end));
    } else {
      const first = this.devicePoint(map, element.first);
      const second = this.devicePoint(map, element.second);
      const end = this.devicePoint(map, element.end);
      this.pen.curveTo(first.x, first.y, second.x, second.y, end.x, end.y);
      this.currentDevice = end;
    }
    this.lineToDevice(this.devicePoint(endMap, next));
  }

  private lineToDevice(point: Point): void {
    if (point.x === this.currentDevice.x && point.y === this.currentDevice.y) return;
    this.pen.lineTo(point.x, point.y);
    this.currentDevice = point;
  }

  private devicePoint(map: HintMap, { x, y }: Point): Point {
    return { x: ftMulFix(x, this.blues.scale), y: map.map(y) };
  }

  private buildHintMap(): void {
    this.hintMap.build(this.hints, this.hints.mask, this.hintOrigin);
  }
}
