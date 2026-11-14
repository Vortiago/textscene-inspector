/**
 * ThorVG's software renderer (`tvgSwRenderer.cpp`): it prepares each shape and bitmap as a task,
 * runs the task at once, as Godot's ThorVG has no worker threads, and draws the tasks into the
 * current surface or into the layers a composition asks for.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, isZero, type Matrix } from '../math';
import type {
  ColorSpace,
  CompositeMethod,
  RenderCompositor,
  RenderData,
  RenderMethod,
  RenderRegion,
  RenderSurface,
} from '../renderMethod';
import type { RenderShape } from '../renderShape';
import { fillGenColorTable, swFill, type SwFill } from './swFill';
import { imageGenRle, imagePrepare } from './swImage';
import { emptyBBox, resetBBox, type SwBBox } from './swMath';
import type { SwRle } from './swOutline';
import { multiply } from './swPixel';
import {
  rasterClear,
  rasterDirectImage,
  rasterDirectRleImage,
  rasterGradientShape,
  rasterGradientStroke,
  rasterPremultiply,
  rasterScaledImage,
  rasterScaledRleImage,
  rasterShape,
  rasterStroke,
  rasterUnpremultiply,
} from './swRaster';
import { rleClipByBox, rleClipByRle } from './swRle';
import {
  shapeGenRle,
  shapeGenStrokeRle,
  shapePrepare,
  shapeResetStroke,
  swShape,
  type SwShape,
} from './swShape';
import {
  channelSizeOf,
  pixelBuffer,
  swCompositor,
  swImage,
  SwSurface,
  type SwCompositor,
  type SwImage,
} from './swSurface';
import { rasterTexmapPolygon } from './swTexmap';

/** `SwTask`: what every prepared paint keeps, and the region it draws in once it has run. */
abstract class SwTask {
  bbox: SwBBox = emptyBBox();
  transform: Matrix | null = null;
  clips: readonly RenderData[] = [];
  opacity = 0;

  /** `SwTask::bounds`: the region, from 0 at its left and top. */
  bounds(): RenderRegion {
    const x = Math.max(this.bbox.min.x, 0);
    const y = Math.max(this.bbox.min.y, 0);
    return { x, y, w: Math.max(0, this.bbox.max.x - x), h: Math.max(0, this.bbox.max.y - y) };
  }

  abstract clip(target: SwRle): boolean;
  abstract run(): void;
}

class SwShapeTask extends SwTask {
  readonly shape: SwShape = swShape();
  fill: SwFill | null = null;
  strokeFill: SwFill | null = null;

  constructor(
    readonly rs: RenderShape,
    public isClipper: boolean
  ) {
    super();
  }

  /** Antialiasing is off under a stroke this wide, which covers the fill's edge, unless the stroke can show it. */
  private isAntiAliased(strokeWidth: number): boolean {
    const stroke = this.rs.stroke;
    return strokeWidth < 2 || stroke!.dashPattern.length > 0 || stroke!.strokeFirst || stroke!.color[3] < 255;
  }

  /** The stroke's width on the surface, or 0 for a stroke that draws nothing. */
  private validStrokeWidth(): number {
    const stroke = this.rs.stroke;
    if (!stroke || isZero(stroke.width)) return 0;
    if (!stroke.fill && multiply(stroke.color[3], this.opacity) === 0) return 0;
    const m = this.transform!;
    return f32(stroke.width * Math.sqrt(f32(f32(m.e11 * m.e11) + f32(m.e12 * m.e12))));
  }

  clip(target: SwRle): boolean {
    if (this.shape.fastTrack) return rleClipByBox(target, this.bbox);
    if (this.shape.rle) return rleClipByRle(target, this.shape.rle);
    return false;
  }

  run(): void {
    if (this.opacity === 0 && !this.isClipper) {
      resetBBox(this.bbox);
      return;
    }
    if (!this.prepare()) this.fail();
  }

  /** The fill's and the stroke's coverage, cut by the clips, or false where a step fails. */
  private prepare(): boolean {
    const { rs, shape } = this;
    const transform = this.transform!;
    const strokeWidth = this.validStrokeWidth();
    const renderRegion = emptyBBox();
    let isFilled = multiply(rs.color[3], this.opacity) > 0 || rs.fill !== null;
    resetShape(shape);
    if (isFilled || this.isClipper) {
      if (shapePrepare(shape, rs, transform, this.bbox, renderRegion, this.clips.length > 0)) {
        shapeGenRle(shape, this.isAntiAliased(strokeWidth));
      } else {
        isFilled = false;
        resetBBox(renderRegion);
      }
    }
    if (isFilled && rs.fill) {
      this.fill = swFill();
      if (!fillGenColorTable(this.fill, rs.fill, transform, this.opacity)) return false;
    }
    if (strokeWidth > 0) {
      shapeResetStroke(shape, rs, transform);
      if (!shapeGenStrokeRle(shape, rs, transform, this.bbox, renderRegion)) return false;
      const strokeFill = rs.stroke!.fill;
      if (strokeFill) {
        this.strokeFill = swFill();
        if (!fillGenColorTable(this.strokeFill, strokeFill, transform, this.opacity)) return false;
      }
    } else {
      shape.stroke = null;
      shape.strokeRle = null;
    }
    shape.outline = null;
    for (const clip of this.clips as SwTask[]) {
      const isFillClipped = shape.rle ? clip.clip(shape.rle) : true;
      const isStrokeClipped = shape.strokeRle ? clip.clip(shape.strokeRle) : true;
      if (!isFillClipped && !isStrokeClipped) return false;
    }
    this.bbox = renderRegion;
    return true;
  }

  private fail(): void {
    resetBBox(this.bbox);
    resetShape(this.shape);
    if (this.shape.strokeRle) this.shape.strokeRle.spans = [];
    this.shape.outline = null;
  }
}

/** `shapeReset`: the coverage emptied, the region cleared. */
function resetShape(shape: SwShape): void {
  if (shape.rle) shape.rle.spans = [];
  shape.fastTrack = false;
  resetBBox(shape.bbox);
}

class SwImageTask extends SwTask {
  readonly image: SwImage;

  constructor(readonly source: RenderSurface) {
    super();
    this.image = swImage(
      {
        buf8: new Uint8Array(source.data.buffer, source.data.byteOffset, source.data.byteLength),
        buf32: source.data,
      },
      source.w,
      source.h,
      source.stride,
      4
    );
  }

  /** ThorVG reports a bitmap used as a clip and lets it pass. */
  clip(): boolean {
    return true;
  }

  run(): void {
    const clipRegion = { min: { ...this.bbox.min }, max: { ...this.bbox.max } };
    const { source, image } = this;
    if (!source.isPremultiplied) {
      rasterPremultiply(source.data, source.w, source.h, source.stride);
      source.isPremultiplied = true;
    }
    if (this.opacity === 0) return;
    if (image.rle) image.rle.spans = [];
    if (image.w === 0 || image.h === 0) return;
    if (!imagePrepare(image, this.transform!, clipRegion, this.bbox)) return;
    if (this.clips.length === 0) return;
    imageGenRle(image, this.bbox, false);
    for (const clip of this.clips as SwTask[]) {
      if (!clip.clip(image.rle!)) {
        image.rle!.spans = [];
        return;
      }
    }
  }
}

/** `SwRenderer`: the surface it draws into, the viewport, and the layers it keeps for reuse. */
export class SwRenderer implements RenderMethod {
  private surface: SwSurface;
  private vport: RenderRegion;
  private readonly compositors: SwSurface[] = [];

  /** `target`: a surface of `w` by `h` ARGB words with no stride padding. */
  constructor(w: number, h: number) {
    this.surface = new SwSurface(pixelBuffer(w * h, 4), w, h, w, 'ARGB8888S', 4);
    this.vport = { x: 0, y: 0, w, h };
  }

  /** The words of the surface it was made with. */
  get pixels(): Uint32Array {
    return this.surface.buf32.subarray(0, this.surface.w * this.surface.h);
  }

  prepareShape(
    rs: RenderShape,
    data: RenderData | null,
    transform: Matrix,
    clips: readonly RenderData[],
    opacity: number,
    isClipper: boolean
  ): RenderData {
    const task = (data as SwShapeTask | null) ?? new SwShapeTask(rs, isClipper);
    task.isClipper = isClipper;
    return this.prepareTask(task, transform, clips, opacity);
  }

  prepareImage(
    source: RenderSurface,
    data: RenderData | null,
    transform: Matrix,
    clips: readonly RenderData[],
    opacity: number
  ): RenderData {
    return this.prepareTask(
      (data as SwImageTask | null) ?? new SwImageTask(source),
      transform,
      clips,
      opacity
    );
  }

  /** `prepareCommon`: a transform that flattens the paint leaves the task unrun. */
  private prepareTask(
    task: SwTask,
    transform: Matrix,
    clips: readonly RenderData[],
    opacity: number
  ): SwTask {
    if ((transform.e11 === 0 && transform.e12 === 0) || (transform.e21 === 0 && transform.e22 === 0))
      return task;
    task.clips = [...clips];
    task.transform = transform;
    task.opacity = opacity;
    const { x, y, w, h } = this.vport;
    task.bbox = {
      min: { x: Math.max(0, x), y: Math.max(0, y) },
      max: { x: Math.min(this.surface.w, x + w), y: Math.min(this.surface.h, y + h) },
    };
    task.run();
    return task;
  }

  /** `preRender`: clears the surface. */
  preRender(): boolean {
    return rasterClear(this.surface, 0, 0, this.surface.w, this.surface.h);
  }

  /** `postRender`: the surface back to straight alpha. */
  postRender(): void {
    rasterUnpremultiply(this.surface);
  }

  renderShape(data: RenderData): boolean {
    const task = data as SwShapeTask;
    if (task.opacity === 0) return true;
    if (task.rs.stroke?.strokeFirst) {
      this.renderStroke(task);
      this.renderFill(task);
    } else {
      this.renderFill(task);
      this.renderStroke(task);
    }
    return true;
  }

  private renderFill(task: SwShapeTask): void {
    const { rs, shape, opacity } = task;
    if (rs.fill) {
      if (task.fill) rasterGradientShape(this.surface, shape, task.fill, rs.fill, opacity);
      return;
    }
    const [r, g, b, alpha] = rs.color;
    const a = multiply(opacity, alpha);
    if (a > 0) rasterShape(this.surface, shape, r, g, b, a);
  }

  private renderStroke(task: SwShapeTask): void {
    const { rs, shape, opacity } = task;
    const stroke = rs.stroke;
    if (!stroke) return;
    if (stroke.fill) {
      if (task.strokeFill) rasterGradientStroke(this.surface, shape, task.strokeFill, stroke.fill, opacity);
      return;
    }
    const [r, g, b, alpha] = stroke.color;
    const a = multiply(opacity, alpha);
    if (a > 0) rasterStroke(this.surface, shape, r, g, b, a);
  }

  renderImage(data: RenderData): boolean {
    const task = data as SwImageTask;
    if (task.opacity === 0) return true;
    const { bbox, image, opacity } = task;
    const surface = this.surface;
    if (
      bbox.max.x <= bbox.min.x ||
      bbox.max.y <= bbox.min.y ||
      bbox.min.x >= surface.w ||
      bbox.min.y >= surface.h
    )
      return true;
    const transform = task.transform!;
    if (image.rle) {
      if (image.direct) return rasterDirectRleImage(surface, image, opacity);
      if (image.scaled) return rasterScaledRleImage(surface, image, transform, opacity);
      return this.renderMappedRleImage(task);
    }
    if (image.direct) return rasterDirectImage(surface, image, bbox, opacity);
    if (image.scaled) return rasterScaledImage(surface, image, transform, bbox, opacity);
    return rasterTexmapPolygon(surface, image, transform, bbox, opacity);
  }

  /** A clipped bitmap under a full map: mapped into a layer first, then drawn through its clip. */
  private renderMappedRleImage(task: SwImageTask): boolean {
    const { bbox, image } = task;
    const layer = this.request(4);
    const compositor = layer.compositor!;
    compositor.method = 'None';
    compositor.valid = true;
    compositor.image.rle = image.rle;
    rasterClear(layer, bbox.min.x, bbox.min.y, bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
    rasterTexmapPolygon(layer, image, task.transform!, bbox, 255);
    return rasterDirectRleImage(this.surface, compositor.image, task.opacity);
  }

  region(data: RenderData): RenderRegion {
    return (data as SwTask).bounds();
  }

  viewport(): RenderRegion {
    return { ...this.vport };
  }

  setViewport(region: RenderRegion): void {
    this.vport = { ...region };
  }

  /** The colour space of the current surface, which a layer takes from the surface it was made from. */
  colorSpace(): ColorSpace {
    return this.surface.cs;
  }

  /** `request`: a free layer the size of the current surface, or a new one. */
  private request(channelSize: number): SwSurface {
    const { w, h } = this.surface;
    const cached = this.compositors.find(
      (layer) =>
        layer.compositor!.valid &&
        layer.compositor!.image.channelSize === channelSize &&
        layer.w === w &&
        layer.h === h
    );
    if (cached) return cached;
    const layer = new SwSurface(pixelBuffer(w * h, channelSize), w, h, w, this.surface.cs, channelSize);
    layer.compositor = swCompositor(layer);
    this.compositors.push(layer);
    return layer;
  }

  target(region: RenderRegion, cs: ColorSpace, _flags: number): RenderCompositor | null {
    let { x, y, w, h } = region;
    const sw = this.surface.w;
    const sh = this.surface.h;
    if (x >= sw || y >= sh || x + w < 0 || y + h < 0) return null;
    const layer = this.request(channelSizeOf(cs));
    // ThorVG moves a negative origin to 0 without shortening the region.
    x = Math.max(x, 0);
    y = Math.max(y, 0);
    if (x + w > sw) w = sw - x;
    if (y + h > sh) h = sh - y;
    if (w === 0 || h === 0) return null;
    const compositor = layer.compositor!;
    compositor.recoverSfc = this.surface;
    compositor.recoverCmp = this.surface.compositor;
    compositor.valid = false;
    compositor.bbox = { min: { x, y }, max: { x: x + w, y: y + h } };
    rasterClear(layer, x, y, w, h);
    this.surface = layer;
    return compositor;
  }

  beginComposite(compositor: RenderCompositor | null, method: CompositeMethod, opacity: number): boolean {
    if (!compositor) return false;
    const layer = compositor as SwCompositor;
    layer.method = method;
    layer.opacity = opacity;
    if (method !== 'None') {
      this.surface = layer.recoverSfc!;
      this.surface.compositor = layer;
    }
    return true;
  }

  endComposite(compositor: RenderCompositor | null): void {
    if (!compositor) return;
    const layer = compositor as SwCompositor;
    this.surface = layer.recoverSfc!;
    this.surface.compositor = layer.recoverCmp;
    if (layer.valid) return;
    layer.valid = true;
    // A layer with no mask blends onto the surface at its opacity.
    if (layer.method === 'None') rasterDirectImage(this.surface, layer.image, layer.bbox, layer.opacity);
  }
}
