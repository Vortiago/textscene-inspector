/**
 * ThorVG's texture mapper (`tvgSwRasterTexmap.h`): a rotated or skewed bitmap drawn as two
 * triangles with bilinear taps, and its edges smoothed after where the transform is not at right
 * angles. It keeps ThorVG's quirk: a pixel whose tap falls outside the image leaves the row's
 * destination and taps where they are, so the rest of the row draws one pixel to the left.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, isEqual, isZero, transformPoint, type Matrix, type Point } from '../math';
import { isRightAngle } from '../paint';
import type { SwBBox } from './swMath';
import { alphaBlend, interpolate, inverseAlphaOf, multiply } from './swPixel';
import { alphaOf, isCompositing, type SwImage, type SwSurface } from './swSurface';

interface Vertex {
  pt: Point;
  uv: Point;
}

/** Each row's left and right ends, and the smoothing each edge takes. */
interface AALine {
  x: [number, number];
  coverage: [number, number];
  length: [number, number];
}

interface AASpans {
  readonly lines: AALine[];
  readonly yStart: number;
  readonly yEnd: number;
}

/** The edge walk the segments share, as ThorVG's file-level statics are. */
interface EdgeWalk {
  dudx: number;
  dvdx: number;
  dxdya: number;
  dxdyb: number;
  dudya: number;
  dvdya: number;
  xa: number;
  xb: number;
  ua: number;
  va: number;
}

const INT32_MAX = 0x7fffffff;

const modf = (v: number): number => 255 - (Math.trunc(f32(v * 256)) & 255);

/** The bilinear tap at (`u`, `v`), or null outside the image. */
function tap(image: SwImage, u: number, v: number): number | null {
  const uu = Math.trunc(u);
  const vv = Math.trunc(v);
  if (uu >>> 0 >= image.w || vv >>> 0 >= image.h) return null;
  const { buf32: sbuf, stride, w, h } = image;
  const ar = modf(u);
  const ab = modf(v);
  const iru = uu + 1;
  const irv = vv + 1;
  let px = sbuf[vv * stride + uu]!;
  if (iru < w) px = interpolate(px, sbuf[vv * stride + iru]!, ar);
  if (irv < h) {
    let px2 = sbuf[irv * stride + uu]!;
    if (iru < w) px2 = interpolate(px2, sbuf[irv * stride + iru]!, ar);
    px = interpolate(px, px2, ab);
  }
  return px;
}

/** `_rasterPolygonImageSegment`: the rows from `yStart` to `yEnd` between the two edges. */
function segment(
  surface: SwSurface,
  image: SwImage,
  bbox: SwBBox,
  walk: EdgeWalk,
  yRange: [number, number],
  aaSpans: AASpans | null,
  opacity: number
): void {
  const matte = isCompositing(surface) ? surface.compositor! : null;
  const alpha = matte ? alphaOf(matte.method) : null;
  const csize = matte ? matte.image.channelSize : 0;
  const yStart = Math.max(yRange[0], bbox.min.y);
  const yEnd = Math.min(yRange[1], bbox.max.y);
  let { xa, xb, ua, va } = walk;
  for (let y = yStart; y < yEnd; y++) {
    const x1 = Math.max(Math.trunc(xa), bbox.min.x);
    const x2 = Math.min(Math.trunc(xb), bbox.max.x);
    if (aaSpans) {
      const line = aaSpans.lines[y - aaSpans.yStart]!;
      if (line.x[0] > x1) line.x[0] = x1;
      if (line.x[1] < x2) line.x[1] = x2;
    }
    if (x2 - x1 >= 1 && x1 < bbox.max.x && x2 > bbox.min.x) {
      const dx = f32(1 - f32(xa - x1));
      let u = f32(ua + f32(dx * walk.dudx));
      let v = f32(va + f32(dx * walk.dvdx));
      let buf = y * surface.stride + x1;
      let cmp = matte ? (y * matte.image.stride + x1) * csize : 0;
      for (let x = x1; x < x2; x++) {
        const px = tap(image, u, v);
        if (px === null) continue;
        let src: number;
        if (matte) {
          const a = alpha!(matte.image.buf8, cmp);
          src = alphaBlend(px, opacity === 255 ? a : multiply(opacity, a));
          cmp += csize;
        } else {
          src = opacity === 255 ? px : alphaBlend(px, opacity);
        }
        surface.buf32[buf] = (src + alphaBlend(surface.buf32[buf]!, inverseAlphaOf(src))) >>> 0;
        buf++;
        u = f32(u + walk.dudx);
        v = f32(v + walk.dvdx);
      }
    }
    xa = f32(xa + walk.dxdya);
    xb = f32(xb + walk.dxdyb);
    ua = f32(ua + walk.dudya);
    va = f32(va + walk.dvdya);
  }
  Object.assign(walk, { xa, xb, ua, va });
}

/** `_rasterPolygonImage`: one triangle, split at its middle vertex into an upper and a lower part. */
function polygonImage(
  surface: SwSurface,
  image: SwImage,
  bbox: SwBBox,
  vertices: Vertex[],
  walk: EdgeWalk,
  aaSpans: AASpans | null,
  opacity: number
): void {
  const sorted = sortByY(vertices);
  const x = sorted.map((vertex) => vertex.pt.x);
  const y = sorted.map((vertex) => vertex.pt.y);
  const u = sorted.map((vertex) => vertex.uv.x);
  const v = sorted.map((vertex) => vertex.uv.y);
  const [x0, x1, x2] = x as [number, number, number];
  const [y0, y1, y2] = y as [number, number, number];
  const [u0, u1, u2] = u as [number, number, number];
  const [v0, v1, v2] = v as [number, number, number];
  const yi = [Math.trunc(y0), Math.trunc(y1), Math.trunc(y2)] as const;
  // Too thin to cover a pixel.
  if (
    (yi[0] === yi[1] && yi[0] === yi[2]) ||
    (Math.trunc(x0) === Math.trunc(x1) && Math.trunc(x0) === Math.trunc(x2))
  )
    return;
  const cross = (a2: number, a0: number, b1: number, b0: number, a1: number, b2: number): number =>
    f32(f32(f32(a2 - a0) * f32(b1 - b0)) - f32(f32(a1 - a0) * f32(b2 - b0)));
  let denom = cross(x2, x0, y1, y0, x1, y2);
  if (isZero(denom)) return;
  denom = f32(1 / denom);
  walk.dudx = f32(cross(u2, u0, y1, y0, u1, y2) * denom);
  walk.dvdx = f32(cross(v2, v0, y1, y0, v1, y2) * denom);
  const dudy = f32(cross(u1, u0, x2, x0, u2, x1) * denom);
  const dvdy = f32(cross(v1, v0, x2, x0, v2, x1) * denom);
  const dxdy = [
    y1 > y0 ? f32(f32(x1 - x0) / f32(y1 - y0)) : 0,
    y2 > y0 ? f32(f32(x2 - x0) / f32(y2 - y0)) : 0,
    y2 > y1 ? f32(f32(x2 - x1) / f32(y2 - y1)) : 0,
  ] as const;
  let isLongEdgeRight = dxdy[1] > dxdy[0];
  if (isEqual(y0, y1)) isLongEdgeRight = x0 > x1;
  if (isEqual(y1, y2)) isLongEdgeRight = x2 > x1;
  const draw = (from: number, to: number): void =>
    segment(surface, image, bbox, walk, [from, to], aaSpans, opacity);
  const slopeA = (slope: number): void => {
    walk.dxdya = slope;
    walk.dudya = f32(f32(slope * walk.dudx) + dudy);
    walk.dvdya = f32(f32(slope * walk.dvdx) + dvdy);
  };
  const offsetY = (top: number): number => (top < bbox.min.y ? f32(bbox.min.y - top) : 0);
  let isUpperDrawn = false;
  if (!isLongEdgeRight) {
    slopeA(dxdy[1]);
    const dy = f32(1 - f32(y0 - yi[0]));
    walk.xa = f32(x0 + f32(dy * walk.dxdya));
    walk.ua = f32(u0 + f32(dy * walk.dudya));
    walk.va = f32(v0 + f32(dy * walk.dvdya));
    if (yi[0] < yi[1]) {
      const offY = offsetY(y0);
      walk.xa = f32(walk.xa + f32(offY * walk.dxdya));
      walk.ua = f32(walk.ua + f32(offY * walk.dudya));
      walk.va = f32(walk.va + f32(offY * walk.dvdya));
      walk.dxdyb = dxdy[0];
      walk.xb = f32(f32(x0 + f32(dy * walk.dxdyb)) + f32(offY * walk.dxdyb));
      draw(yi[0], yi[1]);
      isUpperDrawn = true;
    }
    if (yi[1] < yi[2]) {
      const offY = offsetY(y1);
      if (!isUpperDrawn) {
        walk.xa = f32(walk.xa + f32(offY * walk.dxdya));
        walk.ua = f32(walk.ua + f32(offY * walk.dudya));
        walk.va = f32(walk.va + f32(offY * walk.dvdya));
      }
      walk.dxdyb = dxdy[2];
      walk.xb = f32(f32(x1 + f32(f32(1 - f32(y1 - yi[1])) * walk.dxdyb)) + f32(offY * walk.dxdyb));
      draw(yi[1], yi[2]);
    }
    return;
  }
  walk.dxdyb = dxdy[1];
  let dy = f32(1 - f32(y0 - yi[0]));
  walk.xb = f32(x0 + f32(dy * walk.dxdyb));
  if (yi[0] < yi[1]) {
    const offY = offsetY(y0);
    walk.xb = f32(walk.xb + f32(offY * walk.dxdyb));
    slopeA(dxdy[0]);
    walk.xa = f32(f32(x0 + f32(dy * walk.dxdya)) + f32(offY * walk.dxdya));
    walk.ua = f32(f32(u0 + f32(dy * walk.dudya)) + f32(offY * walk.dudya));
    walk.va = f32(f32(v0 + f32(dy * walk.dvdya)) + f32(offY * walk.dvdya));
    draw(yi[0], yi[1]);
    isUpperDrawn = true;
  }
  if (yi[1] < yi[2]) {
    const offY = offsetY(y1);
    if (!isUpperDrawn) walk.xb = f32(walk.xb + f32(offY * walk.dxdyb));
    slopeA(dxdy[2]);
    dy = f32(1 - f32(y1 - yi[1]));
    walk.xa = f32(f32(x1 + f32(dy * walk.dxdya)) + f32(offY * walk.dxdya));
    walk.ua = f32(f32(u1 + f32(dy * walk.dudya)) + f32(offY * walk.dudya));
    walk.va = f32(f32(v1 + f32(dy * walk.dvdya)) + f32(offY * walk.dvdya));
    draw(yi[1], yi[2]);
  }
}

/** The vertices in ascending y, by ThorVG's three swaps. */
function sortByY(vertices: Vertex[]): Vertex[] {
  const sorted = [...vertices];
  const swap = (i: number, j: number): void => {
    [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
  };
  if (sorted[0]!.pt.y > sorted[1]!.pt.y) swap(0, 1);
  if (sorted[0]!.pt.y > sorted[2]!.pt.y) swap(0, 2);
  if (sorted[1]!.pt.y > sorted[2]!.pt.y) swap(1, 2);
  return sorted;
}

function aaSpansOf(yStart: number, yEnd: number): AASpans {
  const lines = Array.from({ length: Math.max(0, yEnd - yStart) }, (): AALine => ({
    x: [INT32_MAX, 0],
    coverage: [0, 0],
    length: [0, 0],
  }));
  return { lines, yStart, yEnd };
}

function irregularCoverage(
  lines: AALine[],
  eidx: number,
  y: number,
  diagonal: number,
  edgeDist: number,
  isReversed: boolean
): void {
  if (eidx === 1) isReversed = !isReversed;
  const coverage = Math.trunc(255 / (diagonal + 2));
  for (let ry = 0; ry < diagonal + 2; ry++) {
    const at = y - ry - edgeDist;
    if (at < 0) return;
    lines[at]!.length[eidx] = 1;
    lines[at]!.coverage[eidx] = isReversed ? 255 - coverage * ry : coverage * ry;
  }
}

function verticalCoverage(
  lines: AALine[],
  eidx: number,
  y: number,
  rewind: number,
  isReversed: boolean
): void {
  if (eidx === 1) isReversed = !isReversed;
  const coverage = Math.trunc(255 / (rewind + 1));
  for (let ry = 1; ry < rewind + 1; ry++) {
    const at = y - ry;
    if (at < 0) return;
    lines[at]!.length[eidx] = 1;
    lines[at]!.coverage[eidx] = isReversed ? 255 - coverage * ry : coverage * ry;
  }
}

function horizontalCoverage(lines: AALine[], eidx: number, y: number, x: number, x2: number): void {
  const line = lines[y];
  if (!line) return;
  line.length[eidx] = Math.abs(x - x2);
  line.coverage[eidx] = Math.trunc(255 / (line.length[eidx] + 1));
}

const DIR_OUT_HOR = 0x0011;
const DIR_OUT_VER = 0x0001;
const DIR_IN_HOR = 0x0010;
const DIR_IN_VER = 0x0000;
const DIR_NONE = 0x1000;

/** `_calcAAEdge`: the smoothing of one side's edge, from the direction it steps at each row. */
function calcAAEdge(aaSpans: AASpans, eidx: number): void {
  const { lines } = aaSpans;
  const yEnd = aaSpans.yEnd - aaSpans.yStart;
  let y = 0;
  const pEdge = { x: -1, y: -1 };
  const edgeDiff = { x: 0, y: 0 };
  const tx = [0, 0];
  const ptx = [0, 0];
  let diagonal = 0;
  let prevDir = DIR_NONE;
  let curDir: number;
  const pushVertex = (): void => {
    pEdge.x = lines[y]!.x[eidx]!;
    pEdge.y = y;
    ptx[0] = tx[0]!;
    ptx[1] = tx[1]!;
  };
  if (y < yEnd) {
    pEdge.x = lines[y]!.x[eidx]!;
    pEdge.y = y;
  }
  for (y++; y < yEnd; y++) {
    const line = lines[y]!;
    if (line.x[0] === INT32_MAX) continue;
    if (eidx === 0) {
      tx[0] = pEdge.x;
      tx[1] = line.x[0];
    } else {
      tx[0] = line.x[1];
      tx[1] = pEdge.x;
    }
    edgeDiff.x = tx[0]! - tx[1]!;
    edgeDiff.y = y - pEdge.y;
    if (edgeDiff.x > 0) curDir = edgeDiff.y === 1 ? DIR_OUT_HOR : DIR_OUT_VER;
    else if (edgeDiff.x < 0) curDir = edgeDiff.y === 1 ? DIR_IN_HOR : DIR_IN_VER;
    else curDir = DIR_NONE;
    // A straight diagonal grows.
    if (curDir === prevDir && Math.abs(edgeDiff.x) === 1 && edgeDiff.y === 1) {
      diagonal++;
      pushVertex();
      continue;
    }
    switch (curDir) {
      case DIR_OUT_HOR:
        horizontalCoverage(lines, eidx, y, tx[0]!, tx[1]!);
        if (diagonal > 0) {
          irregularCoverage(lines, eidx, y, diagonal, 0, true);
          diagonal = 0;
        }
        if (prevDir === DIR_OUT_VER) horizontalCoverage(lines, eidx, pEdge.y, ptx[0]!, ptx[1]!);
        if (y === 1) horizontalCoverage(lines, eidx, pEdge.y, tx[0]!, tx[1]!);
        pushVertex();
        break;
      case DIR_OUT_VER:
        verticalCoverage(lines, eidx, y, edgeDiff.y, true);
        if (diagonal > 0) {
          irregularCoverage(lines, eidx, y, diagonal, edgeDiff.y, false);
          diagonal = 0;
        }
        if (prevDir === DIR_OUT_HOR) horizontalCoverage(lines, eidx, pEdge.y, ptx[0]!, ptx[1]!);
        pushVertex();
        break;
      case DIR_IN_HOR:
        horizontalCoverage(lines, eidx, y - 1, tx[0]!, tx[1]!);
        if (diagonal > 0) {
          irregularCoverage(lines, eidx, y, diagonal, 0, false);
          diagonal = 0;
        }
        if (prevDir === DIR_OUT_HOR) horizontalCoverage(lines, eidx, pEdge.y, ptx[0]!, ptx[1]!);
        pushVertex();
        break;
      case DIR_IN_VER:
        verticalCoverage(lines, eidx, y, edgeDiff.y, false);
        if (prevDir === DIR_OUT_HOR) edgeDiff.y -= 1;
        if (diagonal > 0) {
          irregularCoverage(lines, eidx, y, diagonal, edgeDiff.y, true);
          diagonal = 0;
        }
        if (prevDir === DIR_OUT_HOR) horizontalCoverage(lines, eidx, pEdge.y, ptx[0]!, ptx[1]!);
        pushVertex();
        break;
    }
    if (curDir !== DIR_NONE) prevDir = curDir;
  }
  if (edgeDiff.y === 1 && edgeDiff.x !== 0) {
    if (y >= yEnd) y = yEnd - 1;
    horizontalCoverage(lines, eidx, y - 1, ptx[0]!, ptx[1]!);
    horizontalCoverage(lines, eidx, y, tx[0]!, tx[1]!);
  } else {
    y = Math.min(y + 1, yEnd);
    verticalCoverage(lines, eidx, y, edgeDiff.y + 1, (prevDir & 0x1) !== 0);
  }
}

/** `_apply`: blends each row's ends into the pixel beside them by the edge's smoothing. */
function applyAA(surface: SwSurface, aaSpans: AASpans): void {
  calcAAEdge(aaSpans, 0);
  calcAAEdge(aaSpans, 1);
  const buf = surface.buf32;
  const end = surface.h * surface.stride;
  for (let y = aaSpans.yStart; y < aaSpans.yEnd; y++) {
    const line = aaSpans.lines[y - aaSpans.yStart]!;
    if (line.x[1] - line.x[0] <= 0) continue;
    const offset = y * surface.stride;
    let dst = offset + line.x[0];
    let pixel = line.x[0] > 1 ? buf[dst - 1]! : buf[dst]!;
    let pos = 1;
    if (dst + line.length[0] >= end) pos += dst + line.length[0] - end;
    while (pos <= line.length[0]) {
      buf[dst] = interpolate(buf[dst]!, pixel, (line.coverage[0] * pos) & 0xff);
      dst++;
      pos++;
    }
    dst = offset + line.x[1] - 1;
    pixel = line.x[1] < surface.w - 1 ? buf[dst + 1]! : buf[dst]!;
    pos = line.length[1];
    if (dst - pos < 0) pos = dst;
    while (pos > 0) {
      buf[dst] = interpolate(buf[dst]!, pixel, (255 - line.coverage[1] * pos) & 0xff);
      dst--;
      pos--;
    }
  }
}

/** `rasterTexmapPolygon`: a bitmap through any transform over `bbox`, in two triangles. */
export function rasterTexmapPolygon(
  surface: SwSurface,
  image: SwImage,
  transform: Matrix,
  bbox: SwBBox,
  opacity: number
): boolean {
  if (surface.channelSize === 1) return false;
  const w = image.w;
  const h = image.h;
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const vertices = corners.map((corner) => ({ pt: transformPoint(corner, transform), uv: corner }));
  const ys = vertices.reduce((least, vertex) => Math.min(least, vertex.pt.y), Number.MAX_VALUE);
  const ye = vertices.reduce((most, vertex) => Math.max(most, vertex.pt.y), -1);
  const yStart = Math.max(Math.trunc(ys), bbox.min.y);
  const yEnd = Math.min(Math.trunc(ye), bbox.max.y);
  const aaSpans = isRightAngle(transform) ? null : aaSpansOf(yStart, yEnd);
  const walk: EdgeWalk = {
    dudx: 0,
    dvdx: 0,
    dxdya: 0,
    dxdyb: 0,
    dudya: 0,
    dvdya: 0,
    xa: 0,
    xb: 0,
    ua: 0,
    va: 0,
  };
  const [v0, v1, v2, v3] = vertices as [Vertex, Vertex, Vertex, Vertex];
  polygonImage(surface, image, bbox, [v0, v1, v3], walk, aaSpans, opacity);
  polygonImage(surface, image, bbox, [v1, v2, v3], walk, aaSpans, opacity);
  if (aaSpans) applyAA(surface, aaSpans);
  return true;
}
