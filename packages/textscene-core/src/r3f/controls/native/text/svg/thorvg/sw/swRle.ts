/**
 * ThorVG's coverage rasterizer (`tvgSwRle.cpp`), FreeType's gray rasterizer in 24.8 subpixels:
 * an outline's cells of area and cover, swept into spans of coverage per row. The cell pool and
 * its bands only split the work by rows, so the spans are those of one pass over every row.
 *
 * Portions ported from ThorVG (MIT License), from FreeType's `ftgrays.c` (FreeType License).
 * Copyright (c) 2020 - 2024 the ThorVG project. Copyright (c) 2000-2024 David Turner, Robert
 * Wilhelm and Werner Lemberg.
 */
import { SW_CURVE_TYPE_POINT, type SwOutline, type SwRle, type SwSpan } from './swOutline';
import { mathSplitCubic, shiftRight, type SwBBox, type SwPoint } from './swMath';

const PIXEL_BITS = 8;
const ONE_PIXEL = 1 << PIXEL_BITS;
const SHRT_MAX = 0x7fff;
/** `ULONG_MAX >> PIXEL_BITS`, which `dx_r` and `dy_r` divide to turn a division into a multiply. */
const RECIPROCAL_BASE = (1n << 56n) - 1n;
const ULONG_MASK = (1n << 64n) - 1n;

interface Cell {
  x: number;
  cover: number;
  area: number;
}

/** `RleWorker`: the cell being accumulated, the cells of each row, and the spans being written. */
interface RleWorker {
  readonly spans: SwSpan[];
  readonly outline: SwOutline;
  readonly isAntiAliased: boolean;
  readonly cellMin: SwPoint;
  readonly cellMax: SwPoint;
  readonly cellXCnt: number;
  readonly cellYCnt: number;
  /** Each row's cells, sorted by column. */
  readonly rows: Cell[][];
  cellPos: SwPoint;
  area: number;
  cover: number;
  pos: SwPoint;
  isInvalid: boolean;
}

const upscale = (pt: SwPoint): SwPoint => ({
  x: pt.x * (1 << (PIXEL_BITS - 6)),
  y: pt.y * (1 << (PIXEL_BITS - 6)),
});
const truncCoord = (x: number): number => shiftRight(x, PIXEL_BITS);
const truncPoint = (pt: SwPoint): SwPoint => ({ x: truncCoord(pt.x), y: truncCoord(pt.y) });
const subpixels = (x: number): number => x * ONE_PIXEL;
const isSamePoint = (a: SwPoint, b: SwPoint): boolean => a.x === b.x && a.y === b.y;

/** `HYPOT`: the alpha max plus beta min estimate of a vector's length. */
function hypot(pt: SwPoint): number {
  const x = Math.abs(pt.x);
  const y = Math.abs(pt.y);
  return x > y ? x + shiftRight(3 * y, 3) : y + shiftRight(3 * x, 3);
}

/** `SW_UDIV`: the high bits of an unsigned 64-bit product, which stands for a division. */
function udiv(a: bigint, b: bigint): number {
  return Number((((a & ULONG_MASK) * (b & ULONG_MASK)) & ULONG_MASK) >> 56n);
}

/** `_horizLine`: a span of `aCount` pixels at the coverage `area` gives, merged with the span before it where it continues it. */
function horizontalLine(rw: RleWorker, cellX: number, cellY: number, area: number, aCount: number): void {
  const x0 = cellX + rw.cellMin.x;
  const y = cellY + rw.cellMin.y;
  if (y < rw.cellMin.y || y >= rw.cellMax.y) return;
  let coverage = Math.abs(area >> (PIXEL_BITS * 2 + 1 - 8));
  if (rw.outline.fillRule === 'EvenOdd') {
    coverage &= 511;
    if (coverage > 255) coverage = 511 - coverage;
  } else if (coverage > 255) coverage = 255;
  if (coverage === 0 || x0 >= SHRT_MAX || y >= SHRT_MAX) return;
  if (!rw.isAntiAliased) coverage = 255;
  const last = rw.spans.at(-1);
  let xOver = 0;
  if (x0 + aCount >= rw.cellMax.x) xOver -= x0 + aCount - rw.cellMax.x;
  if (last && last.coverage === coverage && last.y === y && last.x + last.len === x0) {
    if (x0 < rw.cellMin.x) xOver -= rw.cellMin.x - x0;
    last.len = (last.len + aCount + xOver) & 0xffff;
    return;
  }
  let x = x0;
  if (x < rw.cellMin.x) {
    xOver -= rw.cellMin.x - x;
    x = rw.cellMin.x;
  }
  if (aCount + xOver <= 0) return;
  rw.spans.push({ x, y, len: aCount + xOver, coverage });
}

/** `_sweep`: each row's cells as spans, the cover carried across the gaps between them. */
function sweep(rw: RleWorker): void {
  for (let y = 0; y < rw.cellYCnt; y++) {
    let cover = 0;
    let x = 0;
    for (const cell of rw.rows[y]!) {
      if (cell.x > x && cover !== 0) horizontalLine(rw, x, y, cover * (ONE_PIXEL * 2), cell.x - x);
      cover = (cover + cell.cover) | 0;
      const area = (cover * (ONE_PIXEL * 2) - cell.area) | 0;
      if (area !== 0 && cell.x >= 0) horizontalLine(rw, cell.x, y, area, 1);
      x = cell.x + 1;
    }
    if (cover !== 0) horizontalLine(rw, x, y, cover * (ONE_PIXEL * 2), rw.cellXCnt - x);
  }
}

/** `_recordCell`: adds the area and cover gathered to the cell at the current position. */
function recordCell(rw: RleWorker): void {
  if (!(rw.area || rw.cover)) return;
  const row = rw.rows[rw.cellPos.y]!;
  const x = Math.min(rw.cellPos.x, rw.cellXCnt);
  let at = 0;
  while (at < row.length && row[at]!.x < x) at++;
  let cell = row[at];
  if (!cell || cell.x !== x) {
    cell = { x, cover: 0, area: 0 };
    row.splice(at, 0, cell);
  }
  cell.area += rw.area;
  cell.cover += rw.cover;
}

/** `_setCell`: moves to the cell at `pos`, recording the one left. A cell left of the clip moves to column -1. */
function setCell(rw: RleWorker, pos: SwPoint): void {
  let x = pos.x - rw.cellMin.x;
  const y = pos.y - rw.cellMin.y;
  if (x < 0) x = -1;
  else if (x > rw.cellMax.x) x = rw.cellMax.x;
  if (x !== rw.cellPos.x || y !== rw.cellPos.y) {
    if (!rw.isInvalid) recordCell(rw);
    rw.area = 0;
    rw.cover = 0;
    rw.cellPos = { x, y };
  }
  rw.isInvalid = y < 0 || y >= rw.cellYCnt || x >= rw.cellXCnt;
}

function startCell(rw: RleWorker, pos: SwPoint): void {
  let x = pos.x;
  if (x > rw.cellMax.x) x = rw.cellMax.x;
  if (x < rw.cellMin.x) x = rw.cellMin.x - 1;
  rw.area = 0;
  rw.cover = 0;
  rw.cellPos = { x: x - rw.cellMin.x, y: pos.y - rw.cellMin.y };
  rw.isInvalid = false;
  setCell(rw, { x, y: pos.y });
}

function moveTo(rw: RleWorker, to: SwPoint): void {
  if (!rw.isInvalid) recordCell(rw);
  startCell(rw, truncPoint(to));
  rw.pos = to;
}

/** `SAFE_HYPOT`: the length estimate of a line, without overflow. */
function safeHypot(a: SwPoint, b: SwPoint): number {
  const x = Math.abs(a.x - b.x) >>> 0;
  const y = Math.abs(a.y - b.y) >>> 0;
  return x > y ? x + shiftRight(3 * y, 3) : y + shiftRight(3 * x, 3);
}

/** `_lineTo`: the line from the current position, cell by cell. A line longer than `SHRT_MAX` is halved first. */
function lineTo(rw: RleWorker, to: SwPoint): void {
  const e1Start = truncPoint(rw.pos);
  const e2End = truncPoint(to);
  if (
    (e1Start.y >= rw.cellMax.y && e2End.y >= rw.cellMax.y) ||
    (e1Start.y < rw.cellMin.y && e2End.y < rw.cellMin.y)
  ) {
    rw.pos = to;
    return;
  }
  const stack: SwPoint[] = [{ ...to }, { ...rw.pos }];
  let top = 0;
  for (;;) {
    const end = stack[top]!;
    const start = stack[top + 1]!;
    if (safeHypot(end, start) > SHRT_MAX) {
      // `mathSplitLine`: the midpoint, each half shifted on its own.
      stack[top + 2] = { ...start };
      stack[top + 1] = {
        x: shiftRight(end.x, 1) + shiftRight(start.x, 1),
        y: shiftRight(end.y, 1) + shiftRight(start.y, 1),
      };
      top++;
      continue;
    }
    lineSegment(rw, start, end);
    rw.pos = end;
    if (top === 0) return;
    top--;
  }
}

/** The cells one short line crosses, from `start` to `end`. */
function lineSegment(rw: RleWorker, start: SwPoint, end: SwPoint): void {
  const diff = { x: end.x - start.x, y: end.y - start.y };
  const e1 = truncPoint(start);
  const e2 = truncPoint(end);
  let f1 = { x: start.x - subpixels(e1.x), y: start.y - subpixels(e1.y) };
  if (isSamePoint(e1, e2)) {
    // Within one cell.
  } else if (diff.y === 0) {
    e1.x = e2.x;
    setCell(rw, e1);
  } else if (diff.x === 0) {
    const step = diff.y > 0 ? 1 : -1;
    do {
      const f2y = diff.y > 0 ? ONE_PIXEL : 0;
      rw.cover += f2y - f1.y;
      rw.area += (f2y - f1.y) * f1.x * 2;
      f1 = { x: f1.x, y: diff.y > 0 ? 0 : ONE_PIXEL };
      e1.y += step;
      setCell(rw, e1);
    } while (e1.y !== e2.y);
  } else {
    f1 = diagonalCells(rw, diff, f1, e1, e2);
  }
  const f2 = { x: end.x - subpixels(e2.x), y: end.y - subpixels(e2.y) };
  rw.cover += f2.y - f1.y;
  rw.area += (f2.y - f1.y) * (f1.x + f2.x);
}

/** The cells a sloped line crosses: `prod` tells which side of the current cell the line leaves by. */
function diagonalCells(rw: RleWorker, diff: SwPoint, f1Start: SwPoint, e1: SwPoint, e2: SwPoint): SwPoint {
  let f1 = f1Start;
  let prod = BigInt(diff.x * f1.y - diff.y * f1.x);
  const dxR = RECIPROCAL_BASE / BigInt(diff.x);
  const dyR = RECIPROCAL_BASE / BigInt(diff.y);
  const px = BigInt(diff.x * ONE_PIXEL);
  const py = BigInt(diff.y * ONE_PIXEL);
  do {
    let f2: SwPoint;
    if (prod <= 0n && prod - px > 0n) {
      f2 = { x: 0, y: udiv(-prod, -dxR) };
      prod -= py;
      rw.cover += f2.y - f1.y;
      rw.area += (f2.y - f1.y) * (f1.x + f2.x);
      f1 = { x: ONE_PIXEL, y: f2.y };
      e1.x--;
    } else if (prod - px <= 0n && prod - px + py > 0n) {
      prod -= px;
      f2 = { x: udiv(-prod, dyR), y: ONE_PIXEL };
      rw.cover += f2.y - f1.y;
      rw.area += (f2.y - f1.y) * (f1.x + f2.x);
      f1 = { x: f2.x, y: 0 };
      e1.y++;
    } else if (prod - px + py <= 0n && prod + py >= 0n) {
      prod += py;
      f2 = { x: ONE_PIXEL, y: udiv(prod, dxR) };
      rw.cover += f2.y - f1.y;
      rw.area += (f2.y - f1.y) * (f1.x + f2.x);
      f1 = { x: 0, y: f2.y };
      e1.x++;
    } else {
      f2 = { x: udiv(prod, -dyR), y: 0 };
      prod += px;
      rw.cover += f2.y - f1.y;
      rw.area += (f2.y - f1.y) * (f1.x + f2.x);
      f1 = { x: f2.x, y: ONE_PIXEL };
      e1.y--;
    }
    setCell(rw, e1);
  } while (!isSamePoint(e1, e2));
  return f1;
}

/** `_cubicTo`: the cubic as lines, split until each piece is flat enough (Hain's rapid termination test). */
function cubicTo(rw: RleWorker, ctrl1: SwPoint, ctrl2: SwPoint, to: SwPoint): void {
  const arc: SwPoint[] = Array.from({ length: 32 * 3 + 1 }, () => ({ x: 0, y: 0 }));
  arc[0] = { ...to };
  arc[1] = { ...ctrl2 };
  arc[2] = { ...ctrl1 };
  arc[3] = { ...rw.pos };
  const ys = [arc[0].y, arc[1].y, arc[2].y, arc[3].y];
  const isOutside = truncCoord(Math.min(...ys)) >= rw.cellMax.y || truncCoord(Math.max(...ys)) < rw.cellMin.y;
  let at = 0;
  for (;;) {
    if (!isOutside && needsSplit(arc, at)) {
      mathSplitCubic(arc, at);
      at += 3;
      continue;
    }
    lineTo(rw, arc[at]!);
    if (at === 0) return;
    at -= 3;
  }
}

/** Whether a cubic's control points lie too far from its chord, or past its ends, to draw as a line. */
function needsSplit(arc: readonly SwPoint[], at: number): boolean {
  const [p0, p1, p2, p3] = [arc[at]!, arc[at + 1]!, arc[at + 2]!, arc[at + 3]!];
  const diff = { x: p3.x - p0.x, y: p3.y - p0.y };
  const length = hypot(diff);
  if (length > SHRT_MAX) return true;
  const sLimit = length * Math.trunc(ONE_PIXEL / 6);
  const diff1 = { x: p1.x - p0.x, y: p1.y - p0.y };
  if (Math.abs(diff.y * diff1.x - diff.x * diff1.y) > sLimit) return true;
  const diff2 = { x: p2.x - p0.x, y: p2.y - p0.y };
  if (Math.abs(diff.y * diff2.x - diff.x * diff2.y) > sLimit) return true;
  return (
    diff1.x * (diff1.x - diff.x) + diff1.y * (diff1.y - diff.y) > 0 ||
    diff2.x * (diff2.x - diff.x) + diff2.y * (diff2.y - diff.y) > 0
  );
}

/** `_decomposeOutline`: each contour as moves, lines and cubics, closed back to its first point. */
function decomposeOutline(rw: RleWorker): void {
  const { pts, types, cntrs } = rw.outline;
  let first = 0;
  for (const last of cntrs) {
    const start = upscale(pts[first]!);
    let pt = first;
    let type = first + 1;
    moveTo(rw, start);
    while (pt < last) {
      if (types[type] === SW_CURVE_TYPE_POINT) {
        pt++;
        type++;
        lineTo(rw, upscale(pts[pt]!));
        continue;
      }
      pt += 3;
      type += 3;
      if (pt <= last) cubicTo(rw, upscale(pts[pt - 2]!), upscale(pts[pt - 1]!), upscale(pts[pt]!));
      else if (pt - 1 === last) cubicTo(rw, upscale(pts[pt - 2]!), upscale(pts[pt - 1]!), start);
      else break;
    }
    lineTo(rw, start);
    first = last + 1;
  }
}

/** `rleRender`: the spans of `outline` within `renderRegion`, at full coverage where it is not antialiased. */
export function rleRender(outline: SwOutline, renderRegion: SwBBox, isAntiAliased: boolean): SwRle {
  const cellYCnt = renderRegion.max.y - renderRegion.min.y;
  const rw: RleWorker = {
    spans: [],
    outline,
    isAntiAliased,
    cellMin: { ...renderRegion.min },
    cellMax: { ...renderRegion.max },
    cellXCnt: renderRegion.max.x - renderRegion.min.x,
    cellYCnt,
    rows: Array.from({ length: Math.max(0, cellYCnt) }, () => []),
    cellPos: { x: 0, y: 0 },
    area: 0,
    cover: 0,
    pos: { x: 0, y: 0 },
    isInvalid: true,
  };
  decomposeOutline(rw);
  if (!rw.isInvalid) recordCell(rw);
  sweep(rw);
  return { spans: rw.spans };
}

/** `_intersectSpansRegion`: the spans of `target` where `clip` covers them, the coverages multiplied. */
function intersectSpansRegion(clip: SwRle, target: SwRle, capacity: number): SwSpan[] {
  const out: SwSpan[] = [];
  const spans = target.spans;
  const clipSpans = clip.spans;
  let s = 0;
  let c = 0;
  while (s < spans.length && c < clipSpans.length) {
    const span = spans[s]!;
    if (clipSpans[c]!.y > span.y) {
      s++;
      continue;
    }
    if (span.y > clipSpans[c]!.y) {
      c++;
      continue;
    }
    for (
      let t = c;
      t < clipSpans.length && out.length < capacity && clipSpans[t]!.y === clipSpans[c]!.y;
      t++
    ) {
      const temp = clipSpans[t]!;
      const sx2 = span.x + span.len;
      const cx2 = temp.x + temp.len;
      if (cx2 < span.x || sx2 < temp.x) continue;
      const x = Math.max(span.x, temp.x);
      const len = Math.min(sx2, cx2) - x;
      if (len > 0)
        out.push({ x, y: temp.y, len, coverage: ((span.coverage * temp.coverage + 0xff) >> 8) & 0xff });
    }
    s++;
  }
  return out;
}

/** `_intersectSpansRect`: the spans of `target` cut to the box. */
function intersectSpansRect(bbox: SwBBox, target: SwRle): SwSpan[] {
  const out: SwSpan[] = [];
  const minX = (bbox.min.x << 16) >> 16;
  const minY = (bbox.min.y << 16) >> 16;
  const maxX = minX + (((bbox.max.x - bbox.min.x) << 16) >> 16) - 1;
  const maxY = minY + (((bbox.max.y - bbox.min.y) << 16) >> 16) - 1;
  for (const span of target.spans) {
    if (span.y > maxY) break;
    if (span.y < minY || span.x > maxX || span.x + span.len <= minX) continue;
    const x = Math.max(span.x, minX);
    const len =
      span.x < minX
        ? Math.min(span.len - (minX - span.x), maxX - minX + 1)
        : Math.min(span.len, maxX - span.x + 1);
    if (len > 0) out.push({ x, y: span.y, len, coverage: span.coverage });
  }
  return out;
}

/** `rleClip(SwRle*, const SwRle*)`: false where either holds no span. */
export function rleClipByRle(rle: SwRle, clip: SwRle): boolean {
  if (rle.spans.length === 0 || clip.spans.length === 0) return false;
  rle.spans = intersectSpansRegion(clip, rle, 2 * Math.max(rle.spans.length, clip.spans.length));
  return true;
}

/** `rleClip(SwRle*, const SwBBox*)`: false where the coverage holds no span. */
export function rleClipByBox(rle: SwRle, clip: SwBBox): boolean {
  if (rle.spans.length === 0) return false;
  rle.spans = intersectSpansRect(clip, rle);
  return true;
}
