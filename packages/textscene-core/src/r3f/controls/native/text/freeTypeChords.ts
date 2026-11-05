/**
 * A path sink that draws each curve as the straight chords FreeType's smooth rasteriser draws
 * (`ftgrays.c`), so that the rasteriser port (`ftGrays.ts`) covers the pixels Godot's glyph bitmap
 * covers. A chord sits up to 1/16 px inside its conic, which moves an edge by that much.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { shiftRight } from './ftVector';
import type { PathSink } from './glyphPath';
import type { Vector2 } from '../../../../godot/math/vector';

/** The sink of a chord path: each point in the rasteriser's frame, 1/256 px with y up. */
export interface ChordSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

/** `PIXEL_BITS` and `ONE_PIXEL` of `ftgrays.c`: the rasteriser places a point in 1/256 px. */
export const PIXEL_BITS = 8;
export const ONE_PIXEL = 1 << PIXEL_BITS;
/** A conic whose `|P0 + P2 - 2 P1|` is within this draws as one chord: a deviation within 1/16 px. */
const CONIC_FLATNESS = ONE_PIXEL / 4;
/** A cubic whose control points sit within this of their chord trisection points draws as one chord. */
const CUBIC_FLATNESS = ONE_PIXEL / 2;

/** A point in the rasteriser's frame: 1/256 px, y up, as FreeType's outline runs. */
type Subpixel = Vector2;

/** The point of `(x, y)`, canvas px with y down, in the rasteriser's frame. */
function toSubpixel(x: number, y: number): Subpixel {
  return { x: x * ONE_PIXEL, y: -y * ONE_PIXEL };
}

/**
 * The chord ends of the conic from `p0`, `gray_render_conic` (`ftgrays.c:1013-1141`): `2^k` chords at
 * even steps of t, each end floored to 1/256 px, for the least k whose deviation is within 1/16 px.
 */
function conicChordEnds(p0: Subpixel, p1: Subpixel, p2: Subpixel): Subpixel[] {
  const bx = p1.x - p0.x;
  const by = p1.y - p0.y;
  const ax = p2.x - p1.x - bx;
  const ay = p2.y - p1.y - by;
  let deviation = Math.max(Math.abs(ax), Math.abs(ay));
  if (deviation <= CONIC_FLATNESS) return [p2];
  let count = 1;
  do {
    deviation = shiftRight(deviation, 2);
    count *= 2;
  } while (deviation > CONIC_FLATNESS);
  // FreeType steps by forward differences on 2^32-scaled integers, which is exact: each end is the
  // curve at t = k / count, floored, and the last is `p2`.
  const ends: Subpixel[] = [];
  const countSquared = count * count;
  for (let k = 1; k < count; k++) {
    ends.push({
      x: p0.x + Math.floor((2 * bx * k * count + ax * k * k) / countSquared),
      y: p0.y + Math.floor((2 * by * k * count + ay * k * k) / countSquared),
    });
  }
  ends.push(p2);
  return ends;
}

/** Whether the cubic `arc` (end first, start last) is flat enough to draw as one chord. */
function isCubicFlat(arc: readonly Subpixel[], at: number): boolean {
  const [end, control2, control1, start] = [arc[at]!, arc[at + 1]!, arc[at + 2]!, arc[at + 3]!];
  return (
    Math.abs(2 * end.x - 3 * control2.x + start.x) <= CUBIC_FLATNESS &&
    Math.abs(2 * end.y - 3 * control2.y + start.y) <= CUBIC_FLATNESS &&
    Math.abs(end.x - 3 * control1.x + 2 * start.x) <= CUBIC_FLATNESS &&
    Math.abs(end.y - 3 * control1.y + 2 * start.y) <= CUBIC_FLATNESS
  );
}

/** `gray_split_cubic` (`ftgrays.c:1249-1278`) on one axis: halves the cubic at `at` in place, with FreeType's floors. */
function splitCubicAxis(arc: Subpixel[], at: number, axis: 'x' | 'y'): void {
  const base = (i: number) => arc[at + i]!;
  base(6)[axis] = base(3)[axis];
  let a = base(0)[axis] + base(1)[axis];
  const b = base(1)[axis] + base(2)[axis];
  let c = base(2)[axis] + base(3)[axis];
  base(5)[axis] = shiftRight(c, 1);
  c += b;
  base(4)[axis] = shiftRight(c, 2);
  base(1)[axis] = shiftRight(a, 1);
  a += b;
  base(2)[axis] = shiftRight(a, 2);
  base(3)[axis] = shiftRight(a + c, 3);
}

/**
 * `gray_split_cubic` and `ft_cubic_split`: halves the cubic at `at` of `arc` (end first) in place, the
 * halves at `at` and `at + 3`, with FreeType's floors.
 */
export function splitCubic(arc: Vector2[], at: number): void {
  while (arc.length < at + 7) arc.push({ x: 0, y: 0 });
  splitCubicAxis(arc, at, 'x');
  splitCubicAxis(arc, at, 'y');
}

/**
 * The chord ends of the cubic from `p0`, `gray_render_cubic` (`ftgrays.c:1281-1336`): it halves the
 * nearest unflat piece until every piece is flat, and draws the pieces from the start.
 */
function cubicChordEnds(p0: Subpixel, p1: Subpixel, p2: Subpixel, p3: Subpixel): Subpixel[] {
  const arc: Subpixel[] = [{ ...p3 }, { ...p2 }, { ...p1 }, { ...p0 }];
  const ends: Subpixel[] = [];
  let at = 0;
  for (;;) {
    if (!isCubicFlat(arc, at)) {
      splitCubic(arc, at);
      at += 3;
      continue;
    }
    ends.push({ ...arc[at]! });
    if (at === 0) return ends;
    at -= 3;
  }
}

/**
 * Wraps `sink` so that a glyph outline traced into it (`traceGlyphContours`) reaches `sink` as
 * FreeType's chords in its own frame. Points in are canvas px, y down. FreeType floors a chord end in its own frame, so
 * an origin on a whole pixel lands each chord where Godot's bitmap has it.
 */
export function freeTypeChordSink(sink: ChordSink): PathSink {
  let current: Subpixel = { x: 0, y: 0 };
  const drawTo = (ends: readonly Subpixel[]) => {
    for (const end of ends) sink.lineTo(end.x, end.y);
    current = ends[ends.length - 1]!;
  };
  return {
    moveTo(x, y) {
      current = toSubpixel(x, y);
      sink.moveTo(current.x, current.y);
    },
    lineTo(x, y) {
      current = toSubpixel(x, y);
      sink.lineTo(current.x, current.y);
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      drawTo(conicChordEnds(current, toSubpixel(cpx, cpy), toSubpixel(x, y)));
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      drawTo(cubicChordEnds(current, toSubpixel(cp1x, cp1y), toSubpixel(cp2x, cp2y), toSubpixel(x, y)));
    },
    closePath() {
      sink.closePath();
    },
  };
}
