/**
 * ThorVG's `RenderMethod` (`tvgRender.h`) as the paint tree calls it, and `RenderRegion`: the
 * engine that prepares, composites and draws paints. The software engine implements it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Matrix } from './math';
import type { RenderShape } from './renderShape';

/** A region in whole pixels. */
export interface RenderRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What an engine keeps for a prepared paint. The paint tree only hands it back. */
export type RenderData = object;

/** The ways a paint draws through another: the SVG loader masks by alpha or by luminance. */
export type CompositeMethod = 'None' | 'AlphaMask' | 'LumaMask';

/** `CompositionFlag`: why a paint draws into a layer of its own first. */
export const CompositionFlag = { Invalid: 0, Opacity: 1, Masking: 4 } as const;

/** The pixel layout of a surface: four channels, or one for an alpha mask. */
export type ColorSpace = 'ARGB8888S' | 'Grayscale8';

/** A bitmap an image paint draws: ARGB words, `stride` of them a row, premultiplied once it draws. */
export interface RenderSurface {
  readonly data: Uint32Array;
  readonly w: number;
  readonly h: number;
  readonly stride: number;
  isPremultiplied: boolean;
}

export type RenderCompositor = object;

export interface RenderMethod {
  prepareShape(
    shape: RenderShape,
    data: RenderData | null,
    transform: Matrix,
    clips: readonly RenderData[],
    opacity: number,
    isClipper: boolean
  ): RenderData;
  prepareImage(
    surface: RenderSurface,
    data: RenderData | null,
    transform: Matrix,
    clips: readonly RenderData[],
    opacity: number
  ): RenderData;
  renderShape(data: RenderData): boolean;
  renderImage(data: RenderData): boolean;
  region(data: RenderData): RenderRegion;
  viewport(): RenderRegion;
  setViewport(region: RenderRegion): void;
  colorSpace(): ColorSpace;
  /** A layer over `region`, or null where the region is off the surface. */
  target(region: RenderRegion, colorSpace: ColorSpace, flags: number): RenderCompositor | null;
  beginComposite(compositor: RenderCompositor | null, method: CompositeMethod, opacity: number): boolean;
  endComposite(compositor: RenderCompositor | null): void;
}

/** `RenderRegion::intersect`. */
export function intersectRegion(region: RenderRegion, other: RenderRegion): void {
  const x1 = region.x + region.w;
  const y1 = region.y + region.h;
  const x2 = other.x + other.w;
  const y2 = other.y + other.h;
  region.x = Math.max(region.x, other.x);
  region.y = Math.max(region.y, other.y);
  region.w = Math.max(0, Math.min(x1, x2) - region.x);
  region.h = Math.max(0, Math.min(y1, y2) - region.y);
}

/** `RenderRegion::add`: grows `region` to hold `other`. */
export function addRegion(region: RenderRegion, other: RenderRegion): void {
  if (other.x < region.x) {
    region.w += region.x - other.x;
    region.x = other.x;
  }
  if (other.y < region.y) {
    region.h += region.y - other.y;
    region.y = other.y;
  }
  if (other.x + other.w > region.x + region.w) region.w = other.x + other.w - region.x;
  if (other.y + other.h > region.y + region.h) region.h = other.y + other.h - region.y;
}

/** The layer a mask draws into: one channel for an alpha mask, four for a luminance mask. */
export const maskColorSpace = (renderer: RenderMethod, method: CompositeMethod): ColorSpace =>
  method === 'AlphaMask' ? 'Grayscale8' : renderer.colorSpace();
