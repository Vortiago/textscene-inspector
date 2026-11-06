/**
 * FreeType's stroker (`ftstroke.c`) as Godot strokes a glyph outline (`text_server_adv.cpp:1377-1393`):
 * closed contours, round joins, butt caps, both borders. The stroked outline is the ring a Label's
 * `outline_size` draws, in FreeType's own fixed point, so its bitmap matches Godot's to the level.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import type { Vector2 } from '../../../../godot/math/vector';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { ftDivFix, ftMulDiv, ftMulFix } from './fontMetrics';
import {
  ANGLE_PI,
  ANGLE_PI2,
  ftAngleDiff,
  ftAtan2,
  ftCos,
  ftTan,
  ftVectorFromPolar,
  ftVectorLength,
  ftVectorUnit,
  shiftRight,
} from './ftVector';
import { reverseFrom } from '../../../../utils/reverseFrom';
import { divide } from './autofit/afHints';
import { splitCubic } from './freeTypeChords';
import {
  contoursScaledOutline,
  scaledOutlineContours,
  toOutlineUnits,
  type ContourTag,
  type GlyphContours,
  type ScaledOutline,
} from './glyphContours';

/** `FT_SMALL_CONIC_THRESHOLD`: a conic piece that turns less than this strokes as one border arc. */
const SMALL_CONIC_THRESHOLD = ANGLE_PI / 6;
/** `FT_SMALL_CUBIC_THRESHOLD`: the same for each half of a cubic piece. */
const SMALL_CUBIC_THRESHOLD = ANGLE_PI / 8;
/** `FT_ARC_CUBIC_ANGLE`: a round join draws one cubic for each quarter turn. */
const ARC_CUBIC_ANGLE = ANGLE_PI / 2;
/** `ft_stroker_inside`: a turn past 89.75 degrees each way is a U-turn, which takes no intersection. */
const LARGEST_INTERSECTED_HALF_TURN = 0x59c000;
/** `FT_SMALL_CONIC_THRESHOLD / 4`: a turn between border arcs past this adds a round join. */
const LARGEST_CONIC_ARC_TURN = SMALL_CONIC_THRESHOLD / 4;
const LARGEST_CUBIC_ARC_TURN = SMALL_CUBIC_THRESHOLD / 4;

/** `FT_StrokeTags`. */
const TAG_ON = 1;
const TAG_CUBIC = 2;
const TAG_BEGIN = 4;
const TAG_END = 8;

/** `FT_IS_SMALL`: within 2/64 px. */
const isSmall = (value: number): boolean => value > -2 && value < 2;

const isNear = (a: Vector2, b: Vector2): boolean => isSmall(a.x - b.x) && isSmall(a.y - b.y);

const plus = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });

/** `FT_SIDE_TO_ROTATE`: the turn from the path direction to border `side`, 0 left and 1 right. */
const sideToRotate = (side: number): number => ANGLE_PI2 - side * ANGLE_PI;

/** `ft_angle_mean`. */
const angleMean = (angle1: number, angle2: number): number => angle1 + divide(ftAngleDiff(angle1, angle2), 2);

/** `ft_conic_split`: halves the conic at `at` of `arc` (end first) in place. */
function splitConic(arc: Vector2[], at: number): void {
  const base = (i: number): Vector2 => (arc[at + i] ??= { x: 0, y: 0 });
  for (const axis of ['x', 'y'] as const) {
    base(4)[axis] = base(2)[axis];
    const a = base(0)[axis] + base(1)[axis];
    const b = base(1)[axis] + base(2)[axis];
    base(3)[axis] = shiftRight(b, 1);
    base(2)[axis] = shiftRight(a + b, 2);
    base(1)[axis] = shiftRight(a, 1);
  }
}

/** The direction of the leg from `from` to `to`, or nothing for a leg within 2/64 px. */
function legAngle(from: Vector2, to: Vector2): number | null {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return isSmall(dx) && isSmall(dy) ? null : ftAtan2(dx, dy);
}

/**
 * The directions in and out of a piece whose legs run `legs` (start first), as
 * `ft_conic_is_small_enough` and `ft_cubic_is_small_enough` take them. A short leg takes the angle
 * of its neighbour, and a piece of short legs keeps `current`.
 */
function legAngles(legs: readonly (number | null)[], current: number): number[] {
  const known = legs.filter((angle): angle is number => angle !== null);
  if (known.length === 0) return legs.map(() => current);
  return legs.map((angle, i) => angle ?? legs[i + 1] ?? legs[i - 1] ?? known[0]!);
}

/** One border of the stroke (`FT_StrokeBorderRec`). */
class StrokeBorder {
  readonly points: Vector2[] = [];
  readonly tags: number[] = [];
  /** Whether the last point is the end of a line, which the next line may move. */
  movable = false;
  /** The index of the current contour's first point, or -1 between contours. */
  private start = -1;

  get last(): Vector2 {
    return this.points[this.points.length - 1]!;
  }

  /** `ft_stroke_border_close`. */
  close(isReversed: boolean): void {
    const start = this.start;
    const count = this.points.length;
    if (count <= start + 1) {
      this.points.length = start;
      this.tags.length = start;
    } else {
      // The last point repeats the first: it replaces it.
      this.points[start] = this.points.pop()!;
      this.tags[start] = this.tags.pop()!;
      if (isReversed) {
        reverseFrom(this.points, start + 1);
        reverseFrom(this.tags, start + 1);
      }
      this.tags[start]! |= TAG_BEGIN;
      this.tags[this.tags.length - 1]! |= TAG_END;
    }
    this.start = -1;
    this.movable = false;
  }

  /** `ft_stroke_border_lineto`. */
  lineTo(to: Vector2, isMovable: boolean): void {
    if (this.movable) {
      this.points[this.points.length - 1] = to;
    } else {
      // A zero-length line adds no point and leaves the border fixed, as FreeType returns before it
      // sets `movable`: the next line must not move the corner point before it.
      if (this.start >= 0 && this.points.length > this.start && isNear(this.last, to)) return;
      this.points.push(to);
      this.tags.push(TAG_ON);
    }
    this.movable = isMovable;
  }

  /** `ft_stroke_border_conicto`. */
  conicTo(control: Vector2, to: Vector2): void {
    this.points.push(control, to);
    this.tags.push(0, TAG_ON);
    this.movable = false;
  }

  /** `ft_stroke_border_cubicto`. */
  cubicTo(control1: Vector2, control2: Vector2, to: Vector2): void {
    this.points.push(control1, control2, to);
    this.tags.push(TAG_CUBIC, TAG_CUBIC, TAG_ON);
    this.movable = false;
  }

  /** `ft_stroke_border_arcto`: the arc round `center` as one cubic per quarter turn. */
  arcTo(center: Vector2, radius: number, angleStart: number, angleDiff: number): void {
    let arcs = 1;
    while (angleDiff > ARC_CUBIC_ANGLE * arcs || -angleDiff > ARC_CUBIC_ANGLE * arcs) arcs++;
    let coef = ftTan(divide(angleDiff, 4 * arcs));
    coef += divide(coef, 3);
    const a0 = ftVectorFromPolar(radius, angleStart);
    let a1 = { x: ftMulFix(-a0.y, coef), y: ftMulFix(a0.x, coef) };
    const start = plus(a0, center);
    a1 = plus(a1, start);
    for (let i = 1; i <= arcs; i++) {
      const a3 = ftVectorFromPolar(radius, angleStart + divide(i * angleDiff, arcs));
      const a2 = { x: ftMulFix(a3.y, coef), y: ftMulFix(-a3.x, coef) };
      const end = plus(a3, center);
      const control2 = plus(a2, end);
      this.cubicTo(a1, control2, end);
      a1 = { x: end.x - control2.x + end.x, y: end.y - control2.y + end.y };
    }
  }

  /** `ft_stroke_border_moveto`. */
  moveTo(to: Vector2): void {
    if (this.start >= 0) this.close(false);
    this.start = this.points.length;
    this.movable = false;
    this.lineTo(to, false);
  }
}

/**
 * The stroker of one outline (`FT_StrokerRec`) at a radius in 26.6, with Godot's round joins on
 * closed contours. `handle_wide_strokes` is false for that pair, so no branch of it is ported.
 */
class Stroker {
  /** Border 0 is left of the path direction, border 1 right. */
  readonly borders = [new StrokeBorder(), new StrokeBorder()] as const;
  private angleIn = 0;
  private angleOut = 0;
  private center: Vector2 = { x: 0, y: 0 };
  private lineLength = 0;
  private isFirstPoint = true;
  private subpathAngle = 0;
  private subpathStart: Vector2 = { x: 0, y: 0 };
  private subpathLineLength = 0;

  constructor(private readonly radius: number) {}

  /** `ft_stroker_arcto`: the round join of border `side`. */
  private arcTo(side: number): void {
    const rotate = sideToRotate(side);
    let total = ftAngleDiff(this.angleIn, this.angleOut);
    if (total === ANGLE_PI) total = -rotate * 2;
    const border = this.borders[side]!;
    border.arcTo(this.center, this.radius, this.angleIn + rotate, total);
    border.movable = false;
  }

  /** `ft_stroker_inside`: where border `side` meets itself inside a corner. */
  private inside(side: number, lineLength: number): void {
    const border = this.borders[side]!;
    const rotate = sideToRotate(side);
    const theta = divide(ftAngleDiff(this.angleIn, this.angleOut), 2);
    let sigma: Vector2 = { x: 0, y: 0 };
    let isIntersected = false;
    // Only two long enough lines meet at their intersection; a curve has no line length.
    if (border.movable && lineLength !== 0 && Math.abs(theta) <= LARGEST_INTERSECTED_HALF_TURN) {
      sigma = ftVectorUnit(theta);
      const minLength = Math.abs(ftMulDiv(this.radius, sigma.y, sigma.x));
      isIntersected = minLength !== 0 && this.lineLength >= minLength && lineLength >= minLength;
    }
    let delta: Vector2;
    if (isIntersected) {
      const phi = this.angleIn + theta + rotate;
      delta = plus(ftVectorFromPolar(ftDivFix(this.radius, sigma.x), phi), this.center);
    } else {
      delta = plus(ftVectorFromPolar(this.radius, this.angleOut + rotate), this.center);
      border.movable = false;
    }
    border.lineTo(delta, false);
  }

  /** `ft_stroker_process_corner`: the inside side meets, the outside side takes a round join. */
  private processCorner(lineLength: number): void {
    const turn = ftAngleDiff(this.angleIn, this.angleOut);
    if (turn === 0) return;
    const insideSide = turn < 0 ? 1 : 0;
    this.inside(insideSide, lineLength);
    this.arcTo(1 - insideSide);
  }

  /** `ft_stroker_subpath_start`: the first point of each border. */
  private subpathStartAt(startAngle: number, lineLength: number): void {
    const delta = ftVectorFromPolar(this.radius, startAngle + ANGLE_PI2);
    this.borders[0].moveTo(plus(this.center, delta));
    this.borders[1].moveTo({ x: this.center.x - delta.x, y: this.center.y - delta.y });
    this.subpathAngle = startAngle;
    this.isFirstPoint = false;
    this.subpathLineLength = lineLength;
  }

  /** `FT_Stroker_BeginSubPath`, for a closed contour. */
  beginSubPath(to: Vector2): void {
    this.isFirstPoint = true;
    this.center = to;
    this.subpathStart = to;
    this.angleIn = 0;
  }

  /** `FT_Stroker_LineTo`. */
  lineTo(to: Vector2): void {
    const delta = { x: to.x - this.center.x, y: to.y - this.center.y };
    // A zero-length line would make a spurious corner.
    if (delta.x === 0 && delta.y === 0) return;
    const lineLength = ftVectorLength(delta);
    const angle = ftAtan2(delta.x, delta.y);
    const offset = ftVectorFromPolar(this.radius, angle + ANGLE_PI2);
    if (this.isFirstPoint) {
      this.subpathStartAt(angle, lineLength);
    } else {
      this.angleOut = angle;
      this.processCorner(lineLength);
    }
    this.borders[0].lineTo(plus(to, offset), true);
    this.borders[1].lineTo({ x: to.x - offset.x, y: to.y - offset.y }, true);
    this.angleIn = angle;
    this.center = to;
    this.lineLength = lineLength;
  }

  /**
   * The join before the piece that leaves at `angleIn`: the subpath start for the first piece of a
   * contour, a corner for the first piece of a curve, and a round join where two pieces of a curve
   * turn by more than `largestArcTurn`.
   */
  private joinPiece(
    angleIn: number,
    isFirstPiece: boolean,
    pieceStart: Vector2,
    largestArcTurn: number
  ): void {
    if (isFirstPiece) {
      if (this.isFirstPoint) {
        this.subpathStartAt(angleIn, 0);
      } else {
        this.angleOut = angleIn;
        this.processCorner(0);
      }
    } else if (Math.abs(ftAngleDiff(this.angleIn, angleIn)) > largestArcTurn) {
      this.center = { ...pieceStart };
      this.angleOut = angleIn;
      this.processCorner(0);
    }
  }

  /** `FT_Stroker_ConicTo`: each border takes one conic per piece that turns less than 30 degrees. */
  conicTo(control: Vector2, to: Vector2): void {
    // A conic of coincident points would make a spurious corner.
    if (isNear(this.center, control) && isNear(control, to)) {
      this.center = to;
      return;
    }
    const arc: Vector2[] = [{ ...to }, { ...control }, { ...this.center }];
    const limit = 30;
    let at = 0;
    let isFirstPiece = true;
    for (;;) {
      const [angleIn, angleOut] = legAngles(
        [legAngle(arc[at + 1]!, arc[at + 2]!), legAngle(arc[at]!, arc[at + 1]!)],
        this.angleIn
      ) as [number, number];
      if (at < limit && Math.abs(ftAngleDiff(angleIn, angleOut)) >= SMALL_CONIC_THRESHOLD) {
        if (this.isFirstPoint) this.angleIn = angleIn;
        splitConic(arc, at);
        at += 2;
        continue;
      }
      this.joinPiece(angleIn, isFirstPiece, arc[at + 2]!, LARGEST_CONIC_ARC_TURN);
      isFirstPiece = false;

      const theta = divide(ftAngleDiff(angleIn, angleOut), 2);
      const phi = angleIn + theta;
      const length = ftDivFix(this.radius, ftCos(theta));
      this.borders.forEach((border, side) => {
        const rotate = sideToRotate(side);
        const control = plus(ftVectorFromPolar(length, phi + rotate), arc[at + 1]!);
        const end = plus(ftVectorFromPolar(this.radius, angleOut + rotate), arc[at]!);
        border.conicTo(control, end);
      });
      this.angleIn = angleOut;
      if (at === 0) break;
      at -= 2;
    }
    this.center = to;
    this.lineLength = 0;
  }

  /** `FT_Stroker_CubicTo`: each border takes one cubic per piece whose halves turn less than 22.5 degrees. */
  cubicTo(control1: Vector2, control2: Vector2, to: Vector2): void {
    // A cubic of coincident points would make a spurious corner.
    if (isNear(this.center, control1) && isNear(control1, control2) && isNear(control2, to)) {
      this.center = to;
      return;
    }
    const arc: Vector2[] = [{ ...to }, { ...control2 }, { ...control1 }, { ...this.center }];
    const limit = 32;
    let at = 0;
    let isFirstPiece = true;
    for (;;) {
      const [angleIn, angleMid, angleOut] = cubicAngles(arc, at, this.angleIn);
      const isSmallEnough =
        Math.abs(ftAngleDiff(angleIn, angleMid)) < SMALL_CUBIC_THRESHOLD &&
        Math.abs(ftAngleDiff(angleMid, angleOut)) < SMALL_CUBIC_THRESHOLD;
      if (at < limit && !isSmallEnough) {
        if (this.isFirstPoint) this.angleIn = angleIn;
        splitCubic(arc, at);
        at += 3;
        continue;
      }
      this.joinPiece(angleIn, isFirstPiece, arc[at + 3]!, LARGEST_CUBIC_ARC_TURN);
      isFirstPiece = false;

      const theta1 = divide(ftAngleDiff(angleIn, angleMid), 2);
      const theta2 = divide(ftAngleDiff(angleMid, angleOut), 2);
      const phi1 = angleMean(angleIn, angleMid);
      const phi2 = angleMean(angleMid, angleOut);
      const length1 = ftDivFix(this.radius, ftCos(theta1));
      const length2 = ftDivFix(this.radius, ftCos(theta2));
      this.borders.forEach((border, side) => {
        const rotate = sideToRotate(side);
        const control1 = plus(ftVectorFromPolar(length1, phi1 + rotate), arc[at + 2]!);
        const control2 = plus(ftVectorFromPolar(length2, phi2 + rotate), arc[at + 1]!);
        const end = plus(ftVectorFromPolar(this.radius, angleOut + rotate), arc[at]!);
        border.cubicTo(control1, control2, end);
      });
      this.angleIn = angleOut;
      if (at === 0) break;
      at -= 3;
    }
    this.center = to;
    this.lineLength = 0;
  }

  /** `FT_Stroker_EndSubPath` for a closed contour: the closing line and the last corner. */
  endSubPath(): void {
    if (!isNear(this.center, this.subpathStart)) this.lineTo(this.subpathStart);
    this.angleOut = this.subpathAngle;
    this.processCorner(this.subpathLineLength);
    this.borders[0].close(false);
    this.borders[1].close(true);
  }

  /** Whether the current contour has drawn no piece yet. */
  get isEmpty(): boolean {
    return this.isFirstPoint;
  }
}

/**
 * The directions in, through the middle and out of the cubic at `at` (end first), as
 * `ft_cubic_is_small_enough` takes them. One short leg between two long ones takes the mean.
 */
function cubicAngles(arc: readonly Vector2[], at: number, current: number): [number, number, number] {
  const first = legAngle(arc[at + 2]!, arc[at + 3]!);
  const middle = legAngle(arc[at + 1]!, arc[at + 2]!);
  const last = legAngle(arc[at]!, arc[at + 1]!);
  if (first !== null && middle === null && last !== null) return [first, angleMean(first, last), last];
  return legAngles([first, middle, last], current) as [number, number, number];
}

/** `FT_Stroker_ParseOutline` with `opened` false: strokes each contour of `outline`. */
function parseOutline(stroker: Stroker, outline: ScaledOutline): void {
  const point = (i: number): Vector2 => ({ x: outline.x[i]!, y: outline.y[i]! });
  let first = 0;
  for (const last of outline.contourEnds) {
    const contourFirst = first;
    first = last + 1;
    // A contour of one point draws nothing.
    if (last <= contourFirst) continue;
    let limit = last;
    let index = contourFirst;
    let start = point(contourFirst);
    if (outline.tags[contourFirst] === ContourPointTag.OFF_CONIC) {
      if (outline.tags[last] === ContourPointTag.ON) {
        start = point(last);
        limit--;
      } else {
        const lastPoint = point(last);
        start = { x: divide(start.x + lastPoint.x, 2), y: divide(start.y + lastPoint.y, 2) };
      }
      // The first point is read again, as the first control point.
      index--;
    }
    stroker.beginSubPath(start);
    strokeContour(stroker, outline, index, limit, start);
    if (!stroker.isEmpty) stroker.endSubPath();
  }
}

/** The pieces of one contour after its start, from point `index + 1` to `limit`. */
function strokeContour(
  stroker: Stroker,
  outline: ScaledOutline,
  firstIndex: number,
  limit: number,
  start: Vector2
): void {
  const point = (i: number): Vector2 => ({ x: outline.x[i]!, y: outline.y[i]! });
  let index = firstIndex;
  while (index < limit) {
    index++;
    const tag: ContourTag = outline.tags[index]!;
    if (tag === ContourPointTag.ON) {
      stroker.lineTo(point(index));
    } else if (tag === ContourPointTag.OFF_CONIC) {
      let control = point(index);
      // A run of control points meets at the midpoints, truncated as C divides.
      for (;;) {
        if (index >= limit) {
          stroker.conicTo(control, start);
          return;
        }
        index++;
        const next = point(index);
        if (outline.tags[index] === ContourPointTag.ON) {
          stroker.conicTo(control, next);
          break;
        }
        stroker.conicTo(control, { x: divide(control.x + next.x, 2), y: divide(control.y + next.y, 2) });
        control = next;
      }
    } else {
      index += 2;
      const end = index <= limit ? point(index) : start;
      stroker.cubicTo(point(index - 2), point(index - 1), end);
      if (index > limit) return;
    }
  }
}

/** `ft_stroke_border_export`: the contours of `border`, appended to `outline`. */
function exportBorder(border: StrokeBorder, outline: ScaledOutline): void {
  border.points.forEach((point, i) => {
    const tag = border.tags[i]!;
    outline.x.push(point.x);
    outline.y.push(point.y);
    outline.tags.push(
      tag & TAG_ON
        ? ContourPointTag.ON
        : tag & TAG_CUBIC
          ? ContourPointTag.OFF_CUBIC
          : ContourPointTag.OFF_CONIC
    );
    if (tag & TAG_END) outline.contourEnds.push(outline.x.length - 1);
  });
}

/**
 * `FT_Glyph_Stroke` with Godot's stroker (`FT_Stroker_Set(radius, BUTT, ROUND, 0)`): the outline of
 * the ring `radius` (26.6) each side of `outline`, left border first.
 */
function strokeOutline(outline: ScaledOutline, radius: number): ScaledOutline {
  const stroker = new Stroker(radius);
  parseOutline(stroker, outline);
  const stroked: ScaledOutline = { x: [], y: [], tags: [], contourEnds: [] };
  for (const border of stroker.borders) exportBorder(border, stroked);
  return stroked;
}

/**
 * The outline of the ring Godot draws round `contours` for an outline of `radiusPx` each side
 * (`textOutline.ts`), in px with y down. Its fill under the non-zero rule is the stroked glyph.
 */
export function strokeGlyphContours(contours: GlyphContours, radiusPx: number): GlyphContours {
  return scaledOutlineContours(strokeOutline(contoursScaledOutline(contours), toOutlineUnits(radiusPx)));
}
