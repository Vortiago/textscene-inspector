/**
 * The software engine's surfaces (`SwSurface`, `SwCompositor`, `SwImage` in `tvgSwCommon.h`): a
 * buffer of ARGB words or of one byte a pixel, the layer a composition draws into, and the bitmap
 * an image or a layer draws from. A buffer is bytes, with a word view where it holds words.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { ColorSpace, CompositeMethod } from '../renderMethod';
import { emptyBBox, type SwBBox } from './swMath';
import type { SwOutline, SwRle } from './swOutline';
import { argbLuma } from './swPixel';

/** Bytes of a buffer, with its words where its pixels are words. */
export interface PixelBuffer {
  readonly buf8: Uint8Array;
  readonly buf32: Uint32Array;
}

/**
 * A buffer of `pixels` pixels of `channelSize` bytes. It holds four more bytes than its pixels, as
 * a luminance mask over a one-byte layer reads a word at its last byte.
 */
export function pixelBuffer(pixels: number, channelSize: number): PixelBuffer {
  const bytes = pixels * channelSize + 4;
  const buffer = new ArrayBuffer(Math.ceil(bytes / 4) * 4);
  return { buf8: new Uint8Array(buffer), buf32: new Uint32Array(buffer) };
}

export const channelSizeOf = (cs: ColorSpace): number => (cs === 'Grayscale8' ? 1 : 4);

export interface SwImage extends PixelBuffer {
  rle: SwRle | null;
  outline: SwOutline | null;
  w: number;
  h: number;
  stride: number;
  /** The offset of the drawn region in the image, for an image drawn at a whole-pixel shift. */
  ox: number;
  oy: number;
  scale: number;
  channelSize: number;
  /** Drawn at a whole-pixel shift, with no scale. */
  direct: boolean;
  /** Drawn scaled along the axes, with no rotation. */
  scaled: boolean;
}

export const swImage = (
  buffer: PixelBuffer,
  w: number,
  h: number,
  stride: number,
  channelSize: number
): SwImage => ({
  ...buffer,
  rle: null,
  outline: null,
  w,
  h,
  stride,
  ox: 0,
  oy: 0,
  scale: 1,
  channelSize,
  direct: false,
  scaled: false,
});

/**
 * `SwSurface`. A layer takes the colour space of the surface it was made from and a channel size of
 * its own, so a one-byte mask layer still answers the colour space of the surface over it.
 */
export class SwSurface {
  constructor(
    public buffer: PixelBuffer,
    readonly w: number,
    readonly h: number,
    readonly stride: number,
    readonly cs: ColorSpace,
    readonly channelSize: number,
    public compositor: SwCompositor | null = null
  ) {}

  get buf8(): Uint8Array {
    return this.buffer.buf8;
  }

  get buf32(): Uint32Array {
    return this.buffer.buf32;
  }
}

/** `SwCompositor`: a layer, the surface and the compositor it restores, and how it composites. */
export interface SwCompositor {
  /** The surface that draws into this layer. */
  readonly surface: SwSurface;
  recoverSfc: SwSurface | null;
  recoverCmp: SwCompositor | null;
  readonly image: SwImage;
  bbox: SwBBox;
  /** False while the layer is drawn into, true once it has composited. */
  valid: boolean;
  method: CompositeMethod;
  opacity: number;
}

export function swCompositor(surface: SwSurface): SwCompositor {
  const image = swImage(surface.buffer, surface.w, surface.h, surface.stride, surface.channelSize);
  image.direct = true;
  return {
    surface,
    recoverSfc: null,
    recoverCmp: null,
    image,
    bbox: emptyBBox(),
    valid: true,
    method: 'None',
    opacity: 255,
  };
}

/** An alpha a mask gives at a pixel: its byte, or the luminance of the word from that byte. */
export type SwAlpha = (bytes: Uint8Array, at: number) => number;

const maskAlpha: SwAlpha = (bytes, at) => bytes[at] ?? 0;

/** A word read from any byte, little-endian, 0 past the buffer. */
const wordAt = (bytes: Uint8Array, at: number): number =>
  ((bytes[at] ?? 0) |
    ((bytes[at + 1] ?? 0) << 8) |
    ((bytes[at + 2] ?? 0) << 16) |
    ((bytes[at + 3] ?? 0) << 24)) >>>
  0;

const lumaAlpha: SwAlpha = (bytes, at) => argbLuma(wordAt(bytes, at));

/** `SwSurface::alpha` with `rasterCompositor`'s table for an ARGB surface. */
export const alphaOf = (method: CompositeMethod): SwAlpha => (method === 'LumaMask' ? lumaAlpha : maskAlpha);

/** `_compositing`: the surface draws through a mask. */
export const isCompositing = (surface: SwSurface): boolean =>
  surface.compositor !== null && surface.compositor.method !== 'None';
