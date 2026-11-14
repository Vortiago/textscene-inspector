/**
 * ThorVG's software raster (`tvgSwRaster.cpp`, `tvgSwRasterC.h`) for what an SVG document reaches:
 * solid and gradient fills of a rectangle or of coverage spans, and bitmaps at a shift or a scale,
 * each plain or through an alpha or luminance mask, into ARGB words or a one-byte mask layer.
 *
 * Godot builds ThorVG without its AVX and NEON paths, so these are its C paths. The SVG loader sets
 * no blend method and no mask past luminance, so the blending and the masking-op paths are not
 * reached and not ported.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Fill } from '../fill';
import { f32, inverse, type Matrix } from '../math';
import { fillFetchSolid, gradientColours, type SwFill } from './swFill';
import { nearbyint, type SwBBox } from './swMath';
import type { SwRle, SwSpan } from './swOutline';
import {
  alphaBlend,
  alphaOf,
  argbJoin,
  blendNormal,
  blendPreNormal,
  interpolate,
  interpolate8,
  inverseAlphaOf,
  multiply,
  premultiply,
  unpremultiply,
} from './swPixel';
import type { SwShape } from './swShape';
import {
  alphaOf as maskAlphaOf,
  isCompositing,
  type SwAlpha,
  type SwImage,
  type SwSurface,
} from './swSurface';

const DOWN_SCALE_TOLERANCE = f32(0.5);

/** The mask a surface draws through: its bytes, its alpha reader and its channel size. */
interface Matte {
  readonly bytes: Uint8Array;
  readonly stride: number;
  readonly csize: number;
  readonly alpha: SwAlpha;
}

function matteOf(surface: SwSurface): Matte {
  const compositor = surface.compositor!;
  const { image } = compositor;
  return {
    bytes: image.buf8,
    stride: image.stride,
    csize: image.channelSize,
    alpha: maskAlphaOf(compositor.method),
  };
}

/** The mask's alpha at a pixel. */
const matteAt = (matte: Matte, x: number, y: number): number =>
  matte.alpha(matte.bytes, (y * matte.stride + x) * matte.csize);

/** `tmp + ALPHA_BLEND(*dst, IA(tmp))`: a premultiplied word over the pixel. */
const over = (src: number, dst: number): number => (src + alphaBlend(dst, inverseAlphaOf(src))) >>> 0;

/** `A + MULTIPLY(*dst, 255 - A)`: a byte over the pixel of a mask layer. */
const over8 = (src: number, dst: number): number => (src + multiply(dst, 255 - src)) & 0xff;

/** The spans to draw: the coverage of `rle`, or the rows of `region` at full coverage where it is null. */
function spanRegion(rle: SwRle | null, region: SwBBox): SwSpan[] {
  if (rle) return rle.spans;
  const spans: SwSpan[] = [];
  const len = region.max.x - region.min.x;
  for (let y = region.min.y; y < region.max.y; y++) spans.push({ y, x: region.min.x, len, coverage: 255 });
  return spans;
}

/** A solid colour, premultiplied by `a`, over the coverage of `rle`, or over `region` where it is null. */
function rasterSolid(
  surface: SwSurface,
  rle: SwRle | null,
  region: SwBBox,
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  const spans = spanRegion(rle, region);
  if (isCompositing(surface)) return rasterMattedSolid(surface, spans, r, g, b, a);
  if (surface.channelSize === 1) return rasterSolid8(surface, spans, a, rle === null);
  const color = argbJoin(r, g, b, a);
  const { buf32, stride } = surface;
  for (const { y, x, len, coverage } of spans) {
    const row = y * stride + x;
    if (a === 255 && coverage === 255) {
      buf32.fill(color, row, row + len);
      continue;
    }
    // A solid colour at partial coverage and a translucent one blend alike, the rectangle by `255 - a`.
    const src = coverage < 255 ? alphaBlend(color, coverage) : color;
    const ialpha = rle ? (a === 255 ? 255 - coverage : inverseAlphaOf(src)) : 255 - a;
    for (let i = row; i < row + len; i++) buf32[i] = (src + alphaBlend(buf32[i]!, ialpha)) >>> 0;
  }
  return true;
}

/** A solid colour into a mask layer: the translucent span blends by `~a`, not by its own coverage. */
function rasterSolid8(surface: SwSurface, spans: readonly SwSpan[], a: number, isRect: boolean): boolean {
  const { buf8, stride } = surface;
  for (const { y, x, len, coverage } of spans) {
    const row = y * stride + x;
    if (a === 255) {
      if (coverage === 255 || isRect) buf8.fill(255, row, row + len);
      else
        for (let i = row; i < row + len; i++)
          buf8[i] = (coverage + multiply(buf8[i]!, 255 - coverage)) & 0xff;
      continue;
    }
    const src = coverage < 255 ? multiply(coverage, a) : a;
    for (let i = row; i < row + len; i++) buf8[i] = (src + multiply(buf8[i]!, 255 - a)) & 0xff;
  }
  return true;
}

function rasterMattedSolid(
  surface: SwSurface,
  spans: readonly SwSpan[],
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  const matte = matteOf(surface);
  const { stride } = surface;
  if (surface.channelSize === 4) {
    const color = argbJoin(r, g, b, a);
    const { buf32 } = surface;
    for (const { y, x, len, coverage } of spans) {
      const src = coverage === 255 ? color : alphaBlend(color, coverage);
      for (let i = 0; i < len; i++) {
        const at = y * stride + x + i;
        buf32[at] = over(alphaBlend(src, matteAt(matte, x + i, y)), buf32[at]!);
      }
    }
    return true;
  }
  const { buf8 } = surface;
  for (const { y, x, len, coverage } of spans) {
    const src = coverage === 255 ? a : multiply(a, coverage);
    for (let i = 0; i < len; i++) {
      const at = y * stride + x + i;
      buf8[at] = interpolate8(src, buf8[at]!, matteAt(matte, x + i, y));
    }
  }
  return true;
}

/** `rasterShape`: the fill's solid colour. */
export function rasterShape(
  surface: SwSurface,
  shape: SwShape,
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  [r, g, b] = premultiplied(r, g, b, a);
  if (shape.fastTrack) return rasterSolid(surface, null, shape.bbox, r, g, b, a);
  return shape.rle !== null && rasterSolid(surface, shape.rle, shape.bbox, r, g, b, a);
}

/** `rasterStroke`: the stroke's solid colour. */
export function rasterStroke(
  surface: SwSurface,
  shape: SwShape,
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  [r, g, b] = premultiplied(r, g, b, a);
  return shape.strokeRle !== null && rasterSolid(surface, shape.strokeRle, shape.bbox, r, g, b, a);
}

function premultiplied(r: number, g: number, b: number, a: number): [number, number, number] {
  if (a === 255) return [r, g, b];
  return [multiply(r, a), multiply(g, a), multiply(b, a)];
}

/** A row of table colours as long as the longest span. */
const rowBuffer = (spans: readonly { len: number }[]): Uint32Array =>
  new Uint32Array(spans.reduce((longest, span) => Math.max(longest, span.len), 1));

/** A gradient over the coverage of `rle`, or over `region` where it is null. */
function rasterGradient(
  surface: SwSurface,
  rle: SwRle | null,
  region: SwBBox,
  fill: SwFill,
  data: Fill
): boolean {
  const spans = spanRegion(rle, region);
  if (isCompositing(surface)) return rasterMattedGradient(surface, spans, fill, data);
  const colours = rowBuffer(spans);
  const { stride } = surface;
  for (const { y, x, len, coverage } of spans) {
    gradientColours(fill, data, y, x, len, colours);
    const row = y * stride + x;
    if (surface.channelSize === 1) {
      gradientRow8(surface.buf8, row, colours, len, fill.isTranslucent || coverage < 255, coverage);
      continue;
    }
    const { buf32 } = surface;
    for (let i = 0; i < len; i++) {
      const dst = buf32[row + i]!;
      const src = colours[i]!;
      if (fill.isTranslucent)
        buf32[row + i] = coverage === 255 ? blendPreNormal(src, dst) : blendNormal(src, dst, coverage);
      else buf32[row + i] = coverage === 255 ? src : interpolate(src, dst, coverage);
    }
  }
  return true;
}

/** A gradient into a mask layer: its alpha alone, added over the pixel where it does not cover it. */
function gradientRow8(
  buf8: Uint8Array,
  row: number,
  colours: Uint32Array,
  len: number,
  isAdded: boolean,
  a: number
): void {
  for (let i = 0; i < len; i++) {
    const src = multiply(a, alphaOf(colours[i]!));
    buf8[row + i] = isAdded ? over8(src, buf8[row + i]!) : src;
  }
}

/**
 * A gradient through a mask. ThorVG writes this one as ARGB words even into a one-byte mask
 * layer, past that layer's end, so a masked gradient inside an alpha mask draws nothing here.
 */
function rasterMattedGradient(
  surface: SwSurface,
  spans: readonly SwSpan[],
  fill: SwFill,
  data: Fill
): boolean {
  if (surface.channelSize !== 4) return true;
  const matte = matteOf(surface);
  const { buf32, stride } = surface;
  const colours = rowBuffer(spans);
  for (const { y, x, len, coverage } of spans) {
    gradientColours(fill, data, y, x, len, colours);
    for (let i = 0; i < len; i++) {
      const at = y * stride + x + i;
      const alpha = matteAt(matte, x + i, y);
      buf32[at] = blendNormal(colours[i]!, buf32[at]!, coverage === 255 ? alpha : multiply(alpha, coverage));
    }
  }
  return true;
}

/** `rasterGradientShape`: the fill's gradient. */
export function rasterGradientShape(
  surface: SwSurface,
  shape: SwShape,
  fill: SwFill,
  data: Fill,
  opacity: number
): boolean {
  const solid = fillFetchSolid(fill, data);
  if (solid) {
    const a = multiply(solid.a, opacity);
    return a > 0 ? rasterShape(surface, shape, solid.r, solid.g, solid.b, a) : true;
  }
  if (shape.fastTrack) return rasterGradient(surface, null, shape.bbox, fill, data);
  return shape.rle !== null && rasterGradient(surface, shape.rle, shape.bbox, fill, data);
}

/** `rasterGradientStroke`: the stroke's gradient. */
export function rasterGradientStroke(
  surface: SwSurface,
  shape: SwShape,
  fill: SwFill,
  data: Fill,
  opacity: number
): boolean {
  if (!shape.strokeRle) return false;
  const solid = fillFetchSolid(fill, data);
  if (solid) {
    const a = multiply(solid.a, opacity);
    return a > 0 ? rasterStroke(surface, shape, solid.r, solid.g, solid.b, a) : true;
  }
  return rasterGradient(surface, shape.strokeRle, shape.bbox, fill, data);
}

/** `rasterDirectImage`: a bitmap at a whole-pixel shift over `region`. */
export function rasterDirectImage(
  surface: SwSurface,
  image: SwImage,
  region: SwBBox,
  opacity: number
): boolean {
  const matte = isCompositing(surface) ? matteOf(surface) : null;
  for (let y = region.min.y; y < region.max.y; y++) {
    for (let x = region.min.x; x < region.max.x; x++) {
      const src = image.buf32[(y + image.oy) * image.stride + (x + image.ox)] ?? 0;
      const at = y * surface.stride + x;
      if (matte) {
        const alpha = matteAt(matte, x, y);
        const a = opacity === 255 ? alpha : multiply(opacity, alpha);
        if (surface.channelSize === 4) surface.buf32[at] = over(alphaBlend(src, a), surface.buf32[at]!);
        else surface.buf8[at] = over8(multiply(alphaOf(src), a), surface.buf8[at]!);
      } else if (surface.channelSize === 4) {
        surface.buf32[at] = over(opacity === 255 ? src : alphaBlend(src, opacity), surface.buf32[at]!);
      } else {
        const dst = surface.buf8[at]!;
        surface.buf8[at] =
          opacity === 255
            ? (alphaOf(src) + multiply(dst, inverseAlphaOf(src))) & 0xff
            : interpolate8(alphaOf(src), dst, opacity);
      }
    }
  }
  return true;
}

/** `rasterDirectRleImage`: a bitmap at a whole-pixel shift over the coverage of its clip. */
export function rasterDirectRleImage(surface: SwSurface, image: SwImage, opacity: number): boolean {
  if (surface.channelSize === 1) return false;
  const matte = isCompositing(surface) ? matteOf(surface) : null;
  for (const { y, x, len, coverage } of image.rle!.spans) {
    const a = multiply(coverage, opacity);
    for (let i = 0; i < len; i++) {
      const src = image.buf32[(y + image.oy) * image.stride + (x + i + image.ox)] ?? 0;
      const at = y * surface.stride + x + i;
      if (matte) {
        const alpha = matteAt(matte, x + i, y);
        surface.buf32[at] = over(alphaBlend(src, a === 255 ? alpha : multiply(a, alpha)), surface.buf32[at]!);
      } else {
        surface.buf32[at] = over(a === 255 ? src : alphaBlend(src, a), surface.buf32[at]!);
      }
    }
  }
  return true;
}

/** How a scaled bitmap samples: a bilinear tap, or a mean over a box for a strong downscale. */
interface Sampler {
  readonly isDownScale: boolean;
  readonly sampleSize: number;
}

function samplerOf(image: SwImage): Sampler {
  return {
    isDownScale: image.scale < DOWN_SCALE_TOLERANCE,
    sampleSize: Math.max(1, Math.trunc(f32(0.5 / image.scale))),
  };
}

/** `_interpUpScaler`: bilinear between the four pixels round (`sx`, `sy`), its rows `w` words apart. */
function upScale(image: SwImage, sx: number, sy: number): number {
  const { buf32: img, w, h } = image;
  const rx = Math.max(0, Math.trunc(sx));
  const ry = Math.max(0, Math.trunc(sy));
  const rx2 = Math.min(rx + 1, w - 1);
  const ry2 = Math.min(ry + 1, h - 1);
  const dx = sx > 0 ? Math.trunc(f32(f32(sx - rx) * 255)) & 0xff : 0;
  const dy = sy > 0 ? Math.trunc(f32(f32(sy - ry) * 255)) & 0xff : 0;
  const c1 = img[rx + ry * w] ?? 0;
  const c2 = img[rx2 + ry * w] ?? 0;
  const c3 = img[rx + ry2 * w] ?? 0;
  const c4 = img[rx2 + ry2 * w] ?? 0;
  return interpolate(interpolate(c4, c3, dx), interpolate(c2, c1, dx), dy);
}

/** `_interpDownScaler`: the mean of every `n / 2 + 1`th pixel of a box round `sx`. */
function downScale(image: SwImage, sx: number, miny: number, maxy: number, n: number): number {
  const { buf32: img, w, stride } = image;
  const minx = Math.max(0, Math.trunc(sx) - n);
  const maxx = Math.min(Math.trunc(sx) + n, w);
  const inc = Math.trunc(n / 2) + 1;
  const sums = [0, 0, 0, 0];
  let count = 0;
  for (let y = miny; y < maxy; y += inc) {
    for (let x = minx; x < maxx; x += inc) {
      const p = img[y * stride + x] ?? 0;
      sums[0]! += p >>> 24;
      sums[1]! += (p >>> 16) & 0xff;
      sums[2]! += (p >>> 8) & 0xff;
      sums[3]! += p & 0xff;
      count++;
    }
  }
  const [a, r, g, b] = sums.map((sum) => Math.trunc(sum / count) & 0xff) as [number, number, number, number];
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

/** The source rows a downscale reads for row `sy`. */
function sampleRows(image: SwImage, sampler: Sampler, sy: number): { miny: number; maxy: number } {
  if (!sampler.isDownScale) return { miny: 0, maxy: 0 };
  const my = nearbyint(sy);
  return { miny: Math.max(0, my - sampler.sampleSize), maxy: Math.min(my + sampler.sampleSize, image.h) };
}

/** A source coordinate inside the image, as `SCALED_IMAGE_RANGE_X` and `_Y` take it. */
const isInside = (s: number, size: number): boolean => !(s <= -0.5 || Math.trunc(f32(s + 0.5)) >= size);

/** The scaled bitmap's pixel at destination (`x`, `y`), or null where the source is outside it. */
function scaledPixel(
  image: SwImage,
  itransform: Matrix,
  sampler: Sampler,
  x: number,
  y: number
): number | null {
  const sy = f32(f32(f32(y * itransform.e22) + itransform.e23) - f32(0.49));
  if (!isInside(sy, image.h)) return null;
  const sx = f32(f32(f32(x * itransform.e11) + itransform.e13) - f32(0.49));
  if (!isInside(sx, image.w)) return null;
  if (!sampler.isDownScale) return upScale(image, sx, sy);
  const { miny, maxy } = sampleRows(image, sampler, sy);
  return downScale(image, sx, miny, maxy, sampler.sampleSize);
}

/** `rasterScaledImage`: a bitmap scaled along the axes over `region`. */
export function rasterScaledImage(
  surface: SwSurface,
  image: SwImage,
  transform: Matrix,
  region: SwBBox,
  opacity: number
): boolean {
  const itransform = inverse(transform);
  if (!itransform) return true;
  const matte = isCompositing(surface) ? matteOf(surface) : null;
  if (matte && surface.channelSize === 1) return false;
  const sampler = samplerOf(image);
  for (let y = region.min.y; y < region.max.y; y++) {
    for (let x = region.min.x; x < region.max.x; x++) {
      const src = scaledPixel(image, itransform, sampler, x, y);
      if (src === null) continue;
      const at = y * surface.stride + x;
      if (matte) {
        const alpha = matteAt(matte, x, y);
        surface.buf32[at] = over(
          alphaBlend(src, opacity === 255 ? alpha : multiply(opacity, alpha)),
          surface.buf32[at]!
        );
      } else if (surface.channelSize === 4) {
        surface.buf32[at] = over(opacity < 255 ? alphaBlend(src, opacity) : src, surface.buf32[at]!);
      } else {
        surface.buf8[at] = multiply(alphaOf(src), opacity);
      }
    }
  }
  return true;
}

/** `rasterScaledRleImage`: a bitmap scaled along the axes over the coverage of its clip. */
export function rasterScaledRleImage(
  surface: SwSurface,
  image: SwImage,
  transform: Matrix,
  opacity: number
): boolean {
  if (surface.channelSize === 1) return false;
  const itransform = inverse(transform);
  if (!itransform) return true;
  const matte = isCompositing(surface) ? matteOf(surface) : null;
  const sampler = samplerOf(image);
  for (const { y, x, len, coverage } of image.rle!.spans) {
    const a = multiply(coverage, opacity);
    for (let px = x; px < x + len; px++) {
      let src = scaledPixel(image, itransform, sampler, px, y);
      if (src === null) continue;
      const at = y * surface.stride + px;
      if (matte) {
        const alpha = matteAt(matte, px, y);
        src = alphaBlend(src, a === 255 ? alpha : multiply(alpha, a));
      } else if (a < 255) {
        src = alphaBlend(src, a);
      }
      surface.buf32[at] = over(src, surface.buf32[at]!);
    }
  }
  return true;
}

/** `rasterClear`: words to `value`, or the bytes of a mask layer to 0. */
export function rasterClear(
  surface: SwSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  value = 0
): boolean {
  if (surface.stride === 0 || surface.w === 0 || surface.h === 0) return false;
  for (let row = 0; row < h; row++) {
    const at = surface.stride * (y + row) + x;
    if (surface.channelSize === 4) surface.buf32.fill(value >>> 0, at, at + w);
    else surface.buf8.fill(0, at, at + w);
  }
  return true;
}

/** `rasterUnpremultiply` of a surface of words. */
export function rasterUnpremultiply(surface: SwSurface): void {
  if (surface.channelSize !== 4) return;
  for (let y = 0; y < surface.h; y++) {
    for (let x = 0; x < surface.w; x++) {
      const at = y * surface.stride + x;
      surface.buf32[at] = unpremultiply(surface.buf32[at]!);
    }
  }
}

/** `rasterPremultiply` of a bitmap, once. */
export function rasterPremultiply(data: Uint32Array, w: number, h: number, stride: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data[y * stride + x] = premultiply(data[y * stride + x]!);
  }
}
