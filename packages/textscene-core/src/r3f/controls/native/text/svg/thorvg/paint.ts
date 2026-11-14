/**
 * ThorVG's paint tree (`tvgPaint.cpp`, `tvgShape.h`, `tvgScene.h`, `tvgPicture.cpp`,
 * `tvgText.h`): shapes, scenes, pictures and text, each with its transform, opacity, clip and
 * mask, and how each prepares and draws through a `RenderMethod`. Every value stays in single
 * precision, as ThorVG computes it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import {
  atan2,
  f32,
  identityMatrix,
  isEqual,
  isIdentity,
  isZero,
  MATH_PI,
  MATH_PI2,
  multiply,
  PATH_KAPPA,
  transformPoint,
  type Matrix,
  type Point,
} from './math';
import { nearbyint } from './sw/swMath';
import { PathCommand } from './renderPath';
import { duplicateFill, type Fill } from './fill';
import {
  halfStroke,
  multiplyAlpha,
  renderShape,
  renderStroke,
  type RenderShape,
  type RenderStroke,
} from './renderShape';
import {
  addRegion,
  CompositionFlag,
  intersectRegion,
  maskColorSpace,
  type CompositeMethod,
  type RenderData,
  type RenderMethod,
  type RenderRegion,
  type RenderSurface,
} from './renderMethod';
import type { FillRule, StrokeCap, StrokeJoin } from './svgNode';

/** A box in float coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FLT_MAX = 3.4028234663852886e38;
const INT32_MAX = 0x7fffffff;

const emptyRegion = (): RenderRegion => ({ x: 0, y: 0, w: 0, h: 0 });

/** `Paint::Impl`: what every paint has, and how it prepares and draws its masks and clips. */
export abstract class Paint {
  abstract readonly type: 'Shape' | 'Scene' | 'Picture' | 'Text';
  /** The paint's own transform, and the product of its parents' with it, which `update` sets. */
  m: Matrix = identityMatrix();
  cm: Matrix = identityMatrix();
  /** Set by `transform`: a set transform ignores `translate`. */
  isOverriding = false;
  opacity = 255;
  mask: { target: Paint; method: Exclude<CompositeMethod, 'None'> } | null = null;
  clipper: Shape | null = null;
  /** Set while the paint, as a mask or clip, is drawn as a viewport instead. */
  isFastTrack = false;

  transform(m: Matrix): void {
    this.m = { ...m };
    this.isOverriding = true;
  }

  /** `Paint::translate`: false where a set transform ignores it. */
  translate(x: number, y: number): boolean {
    if (this.isOverriding) return false;
    this.m.e13 = x;
    this.m.e23 = y;
    return true;
  }

  composite(target: Paint, method: Exclude<CompositeMethod, 'None'>): void {
    this.mask = { target, method };
  }

  clip(clipper: Shape): void {
    this.clipper = clipper;
  }

  /** The paint's own region on the surface, once prepared (`bounds(RenderMethod*)`). */
  abstract region(renderer: RenderMethod): RenderRegion;

  /** The paint's box in its own space, or null where it has none (`bounds(x, y, w, h, stroking)`). */
  protected abstract ownBounds(isStroking: boolean): Box | null;

  protected abstract prepareOwn(
    renderer: RenderMethod,
    transform: Matrix,
    clips: RenderData[],
    opacity: number,
    isClipper: boolean
  ): RenderData | null;

  protected abstract renderOwn(renderer: RenderMethod): boolean;

  abstract duplicate(): Paint;

  /** `Paint::Impl::bounds`: the box, and the box of its corners through the transform where `isTransformed`. */
  bounds(isTransformed: boolean, isStroking: boolean, isOrigin = false): Box | null {
    const m = isOrigin ? this.cm : this.m;
    if (!isTransformed || isIdentity(m)) return this.ownBounds(isStroking);
    const own = this.ownBounds(isStroking);
    const { x, y, w, h } = own ?? { x: 0, y: 0, w: 0, h: 0 };
    const corners: Point[] = [
      { x, y },
      { x: f32(x + w), y },
      { x: f32(x + w), y: f32(y + h) },
      { x, y: f32(y + h) },
    ].map((corner) => transformPoint(corner, m));
    const x1 = Math.min(...corners.map((p) => p.x));
    const x2 = Math.max(...corners.map((p) => p.x));
    const y1 = Math.min(...corners.map((p) => p.y));
    const y2 = Math.max(...corners.map((p) => p.y));
    return own && { x: x1, y: y1, w: f32(x2 - x1), h: f32(y2 - y1) };
  }

  /** `Paint::Impl::update`: prepares the mask, the clip and the paint itself under `pm`. */
  update(
    renderer: RenderMethod,
    pm: Matrix,
    clips: RenderData[],
    opacity: number,
    isClipper: boolean
  ): RenderData | null {
    let viewport = renderer.viewport();
    let isFastTrack = false;
    if (this.mask) {
      const { target, method } = this.mask;
      target.isFastTrack = false;
      if (
        target instanceof Shape &&
        !target.rs.fill &&
        !target.mask &&
        method === 'AlphaMask' &&
        target.rs.color[3] === 255 &&
        target.opacity === 255
      ) {
        viewport = renderer.viewport();
        isFastTrack = compositeFastTrack(renderer, target, pm, viewport);
        target.isFastTrack = isFastTrack;
      }
      if (!isFastTrack) target.update(renderer, pm, clips, 255, false);
    }
    const clipper = this.clipper;
    if (clipper) {
      clipper.isFastTrack = false;
      viewport = renderer.viewport();
      if (
        !clipper.clipper &&
        (clipper.rs.stroke?.width ?? 0) === 0 &&
        compositeFastTrack(renderer, clipper, pm, viewport)
      ) {
        clipper.isFastTrack = true;
        isFastTrack = true;
      } else {
        clips.push(clipper.update(renderer, pm, clips, 255, true)!);
      }
    }
    opacity = multiplyAlpha(opacity, this.opacity);
    this.cm = multiply(pm, this.m);
    const data = this.prepareOwn(renderer, this.cm, clips, opacity, isClipper);
    if (isFastTrack) renderer.setViewport(viewport);
    else if (clipper) clips.pop();
    return data;
  }

  /** `Paint::Impl::render`: draws the mask into a layer, then the paint through it. */
  render(renderer: RenderMethod): boolean {
    if (this.opacity === 0) return true;
    const mask = this.mask;
    let compositor = null;
    if (mask && !mask.target.isFastTrack) {
      const region = { ...this.region(renderer) };
      for (let layer: Paint['mask'] = mask; layer; layer = layer.target.mask) {
        addRegion(region, layer.target.region(renderer));
        if (region.w === 0 || region.h === 0) return true;
      }
      compositor = renderer.target(region, maskColorSpace(renderer, mask.method), CompositionFlag.Masking);
      if (renderer.beginComposite(compositor, 'None', 255)) mask.target.render(renderer);
    }
    if (compositor) renderer.beginComposite(compositor, mask!.method, mask!.target.opacity);
    const isRendered = this.renderOwn(renderer);
    if (compositor) renderer.endComposite(compositor);
    return isRendered;
  }

  /** `Paint::Impl::duplicate`: the transform, opacity, mask and clip copied onto `copy`. */
  protected copyPaintTo<T extends Paint>(copy: T): T {
    copy.m = { ...this.m };
    copy.isOverriding = this.isOverriding;
    copy.opacity = this.opacity;
    if (this.mask) copy.composite(this.mask.target.duplicate(), this.mask.method);
    if (this.clipper) copy.clip(this.clipper.duplicate());
    return copy;
  }
}

/** `rightAngle`: a transform that turns by none, a quarter or a half turn. */
export function isRightAngle(m: Matrix): boolean {
  const radian = Math.abs(atan2(m.e21, m.e11));
  return isZero(radian) || isZero(f32(radian - MATH_PI2)) || isZero(f32(radian - MATH_PI));
}

const isSkewed = (m: Matrix): boolean => !isZero(f32(m.e21 + m.e12));

/** `_clipRect`: whether the clip's quad holds the whole viewport, so it clips nothing. */
function clipHoldsViewport(pts: readonly Point[], m: Matrix, before: RenderRegion): boolean {
  const quad = pts.slice(0, 4).map((pt) => transformPoint(pt, m));
  const sign = (p1: Point, p2: Point, p3: Point): number =>
    f32(f32(f32(p1.x - p3.x) * f32(p2.y - p3.y)) - f32(f32(p2.x - p3.x) * f32(p1.y - p3.y)));
  const isInside = (p: Point): boolean => {
    const sides = [0, 1, 2, 3].map((i) => sign(p, quad[i]!, quad[(i + 1) % 4]!) < 0);
    return sides.every((side) => side === sides[0]);
  };
  const { x, y, w, h } = before;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].every((corner) => isInside({ x: f32(corner.x), y: f32(corner.y) }));
}

/**
 * `_compFastTrack`: true where a four-point mask or clip draws as the viewport instead. An
 * axis-aligned rectangle narrows the viewport to itself; any other quad must hold the viewport.
 */
function compositeFastTrack(
  renderer: RenderMethod,
  target: Shape,
  pm: Matrix,
  before: RenderRegion
): boolean {
  const pts = target.rs.path.pts;
  if (pts.length !== 4) return false;
  const tm = multiply(pm, target.m);
  if (isRightAngle(tm) && !isSkewed(tm)) {
    const [pt1, pt2, pt3, pt4] = pts as [Point, Point, Point, Point];
    const isRectangle =
      (isEqual(pt1.x, pt2.x) && isEqual(pt2.y, pt3.y) && isEqual(pt3.x, pt4.x) && isEqual(pt1.y, pt4.y)) ||
      (isEqual(pt2.x, pt3.x) && isEqual(pt1.y, pt2.y) && isEqual(pt1.x, pt4.x) && isEqual(pt3.y, pt4.y));
    if (isRectangle) {
      const v1 = transformPoint(pt1, tm);
      const v2 = transformPoint(pt3, tm);
      const after = {
        x: nearbyint(Math.min(v1.x, v2.x)),
        y: nearbyint(Math.min(v1.y, v2.y)),
        w: 0,
        h: 0,
      };
      after.w = Math.max(0, nearbyint(Math.max(v1.x, v2.x)) - after.x);
      after.h = Math.max(0, nearbyint(Math.max(v1.y, v2.y)) - after.y);
      intersectRegion(after, before);
      renderer.setViewport(after);
      return true;
    }
  }
  return clipHoldsViewport(pts, tm, before);
}

/** `Shape`: a path with a fill and a stroke. */
export class Shape extends Paint {
  readonly type = 'Shape';
  readonly rs: RenderShape = renderShape();
  private data: RenderData | null = null;
  private compositionFlag: number = CompositionFlag.Invalid;
  private compositionOpacity = 255;

  moveTo(x: number, y: number): void {
    this.rs.path.cmds.push(PathCommand.MoveTo);
    this.rs.path.pts.push({ x, y });
  }

  lineTo(x: number, y: number): void {
    this.rs.path.cmds.push(PathCommand.LineTo);
    this.rs.path.pts.push({ x, y });
  }

  cubicTo(cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number): void {
    this.rs.path.cmds.push(PathCommand.CubicTo);
    this.rs.path.pts.push({ x: cx1, y: cy1 }, { x: cx2, y: cy2 }, { x, y });
  }

  /** Closes the subpath, once: a second close in a row adds nothing. */
  close(): void {
    if (this.rs.path.cmds.at(-1) !== PathCommand.Close) this.rs.path.cmds.push(PathCommand.Close);
  }

  /** `Shape::appendCircle`: an ellipse as four cubics, from its rightmost point clockwise. */
  appendCircle(cx: number, cy: number, rx: number, ry: number): void {
    const rxKappa = f32(rx * PATH_KAPPA);
    const ryKappa = f32(ry * PATH_KAPPA);
    const [left, right, top, bottom] = [f32(cx - rx), f32(cx + rx), f32(cy - ry), f32(cy + ry)];
    this.moveTo(right, cy);
    this.cubicTo(right, f32(cy + ryKappa), f32(cx + rxKappa), bottom, cx, bottom);
    this.cubicTo(f32(cx - rxKappa), bottom, left, f32(cy + ryKappa), left, cy);
    this.cubicTo(left, f32(cy - ryKappa), f32(cx - rxKappa), top, cx, top);
    this.cubicTo(f32(cx + rxKappa), top, right, f32(cy - ryKappa), right, cy);
    this.close();
  }

  /** `Shape::appendRect`: a rectangle, its corner radii clamped to half its sides. */
  appendRect(x: number, y: number, w: number, h: number, radiusX: number, radiusY: number): void {
    const rx = Math.min(radiusX, f32(w * 0.5));
    const ry = Math.min(radiusY, f32(h * 0.5));
    const right = f32(x + w);
    const bottom = f32(y + h);
    if (rx === 0 && ry === 0) {
      this.moveTo(x, y);
      this.lineTo(right, y);
      this.lineTo(right, bottom);
      this.lineTo(x, bottom);
      this.close();
      return;
    }
    const hrx = f32(rx * PATH_KAPPA);
    const hry = f32(ry * PATH_KAPPA);
    const add = (a: number, b: number): number => f32(a + b);
    const sub = (a: number, b: number): number => f32(a - b);
    this.moveTo(add(x, rx), y);
    this.lineTo(sub(right, rx), y);
    this.cubicTo(add(sub(right, rx), hrx), y, right, sub(add(y, ry), hry), right, add(y, ry));
    this.lineTo(right, sub(bottom, ry));
    this.cubicTo(right, add(sub(bottom, ry), hry), add(sub(right, rx), hrx), bottom, sub(right, rx), bottom);
    this.lineTo(add(x, rx), bottom);
    this.cubicTo(sub(add(x, rx), hrx), bottom, x, add(sub(bottom, ry), hry), x, sub(bottom, ry));
    this.lineTo(x, add(y, ry));
    this.cubicTo(x, sub(add(y, ry), hry), sub(add(x, rx), hrx), y, add(x, rx), y);
    this.close();
  }

  fillColor(r: number, g: number, b: number, a: number): void {
    this.rs.fill = null;
    this.rs.color = [r, g, b, a];
  }

  fillGradient(fill: Fill): void {
    this.rs.fill = fill;
  }

  fillRule(rule: FillRule): void {
    this.rs.rule = rule;
  }

  private strokeOf(): RenderStroke {
    return (this.rs.stroke ??= renderStroke());
  }

  strokeWidth(width: number): void {
    this.strokeOf().width = width;
  }

  strokeCap(cap: StrokeCap): void {
    this.strokeOf().cap = cap;
  }

  strokeJoin(join: StrokeJoin): void {
    this.strokeOf().join = join;
  }

  /** A negative miter limit is not taken (`Shape::strokeMiterlimit`). */
  strokeMiterlimit(miterlimit: number): void {
    if (miterlimit >= 0) this.strokeOf().miterlimit = miterlimit;
  }

  strokeColor(r: number, g: number, b: number, a: number): void {
    const stroke = this.strokeOf();
    stroke.fill = null;
    stroke.color = [r, g, b, a];
  }

  strokeGradient(fill: Fill): void {
    const stroke = this.strokeOf();
    stroke.fill = fill;
    stroke.color[3] = 0;
  }

  /** `Shape::Impl::strokeDash`: a pattern of one entry, or with an entry under epsilon, is not taken. */
  strokeDash(pattern: readonly number[], offset: number): void {
    if (pattern.length === 1 || pattern.some((dash) => dash < 1e-6)) return;
    const stroke = this.strokeOf();
    stroke.dashPattern = [...pattern];
    stroke.dashOffset = offset;
  }

  order(isStrokeFirst: boolean): void {
    this.strokeOf().strokeFirst = isStrokeFirst;
  }

  /** `Shape::Impl::needComposition`: whether a translucent or masked fill and stroke need a layer. */
  private needsComposition(opacity: number): boolean {
    this.compositionFlag = CompositionFlag.Invalid;
    if (opacity === 0) return false;
    const { stroke, fill, color } = this.rs;
    if (!stroke || stroke.width < 1e-6 || (!stroke.fill && stroke.color[3] === 0)) return false;
    if (!fill && color[3] === 0) return false;
    if (opacity < 255) {
      this.compositionFlag = CompositionFlag.Opacity;
      return true;
    }
    if (!this.mask) return false;
    const { target, method } = this.mask;
    if ((target.opacity === 255 || target.opacity === 0) && target instanceof Shape && !target.rs.fill) {
      const [r, g, b, a] = target.rs.color;
      if (a === 0 || a === 255) {
        if (method !== 'LumaMask') return false;
        if ((r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0)) return false;
      }
    }
    this.compositionFlag = CompositionFlag.Masking;
    return true;
  }

  protected prepareOwn(
    renderer: RenderMethod,
    transform: Matrix,
    clips: RenderData[],
    opacity: number,
    isClipper: boolean
  ): RenderData {
    if (this.needsComposition(opacity)) {
      this.compositionOpacity = opacity;
      opacity = 255;
    }
    return (this.data = renderer.prepareShape(this.rs, this.data, transform, clips, opacity, isClipper));
  }

  protected renderOwn(renderer: RenderMethod): boolean {
    if (!this.data) return false;
    const compositor = this.compositionFlag
      ? renderer.target(this.region(renderer), renderer.colorSpace(), this.compositionFlag)
      : null;
    if (compositor) renderer.beginComposite(compositor, 'None', this.compositionOpacity);
    const isRendered = renderer.renderShape(this.data);
    if (compositor) renderer.endComposite(compositor);
    return isRendered;
  }

  region(renderer: RenderMethod): RenderRegion {
    return this.data ? renderer.region(this.data) : emptyRegion();
  }

  /** `Shape::Impl::bounds`: the box of the path's points, grown by half the stroke where `isStroking`. */
  protected ownBounds(isStroking: boolean): Box | null {
    const { pts } = this.rs.path;
    let box: Box = { x: 0, y: 0, w: 0, h: 0 };
    if (pts.length > 0) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
      box = { x: minX, y: minY, w: f32(Math.max(...xs) - minX), h: f32(Math.max(...ys) - minY) };
    }
    const stroke = this.rs.stroke;
    if (isStroking && stroke) {
      const half = halfStroke(stroke.width);
      box = {
        x: f32(box.x - half),
        y: f32(box.y - half),
        w: f32(box.w + stroke.width),
        h: f32(box.h + stroke.width),
      };
    }
    return pts.length > 0 ? box : null;
  }

  duplicate(): Shape {
    const copy = this.copyPaintTo(new Shape());
    copy.rs.rule = this.rs.rule;
    copy.rs.color = [...this.rs.color];
    copy.rs.path.cmds.push(...this.rs.path.cmds);
    copy.rs.path.pts.push(...this.rs.path.pts.map((p) => ({ ...p })));
    const stroke = this.rs.stroke;
    copy.rs.stroke = stroke && {
      ...stroke,
      color: [...stroke.color],
      fill: stroke.fill && duplicateFill(stroke.fill),
      dashPattern: [...stroke.dashPattern],
    };
    copy.rs.fill = this.rs.fill && duplicateFill(this.rs.fill);
    return copy;
  }
}

/** `Scene`: a group of paints, drawn in order. */
export class Scene extends Paint {
  readonly type = 'Scene';
  readonly paints: Paint[] = [];
  private viewportOnUpdate: RenderRegion = { x: 0, y: 0, w: INT32_MAX, h: INT32_MAX };
  private compositionFlag: number = CompositionFlag.Invalid;
  private compositionOpacity = 255;

  push(paint: Paint | null): void {
    if (paint) this.paints.push(paint);
  }

  /** `Scene::Impl::needComposition`: a masked scene, or a translucent one of more than one shape or picture. */
  private needsComposition(opacity: number): boolean {
    this.compositionFlag = CompositionFlag.Invalid;
    if (opacity === 0 || this.paints.length === 0) return false;
    if (this.mask) this.compositionFlag |= CompositionFlag.Masking;
    if (opacity === 255) return this.compositionFlag !== 0;
    const only = this.paints.length === 1 ? this.paints[0]! : null;
    if (only && (only.type === 'Shape' || only.type === 'Picture')) return this.compositionFlag !== 0;
    this.compositionFlag |= CompositionFlag.Opacity;
    return true;
  }

  protected prepareOwn(
    renderer: RenderMethod,
    transform: Matrix,
    clips: RenderData[],
    opacity: number
  ): null {
    this.viewportOnUpdate = { ...renderer.viewport() };
    if (this.needsComposition(opacity)) {
      this.compositionOpacity = opacity;
      opacity = 255;
    }
    for (const paint of this.paints) paint.update(renderer, transform, clips, opacity, false);
    return null;
  }

  protected renderOwn(renderer: RenderMethod): boolean {
    const compositor = this.compositionFlag
      ? renderer.target(this.region(renderer), renderer.colorSpace(), this.compositionFlag)
      : null;
    if (compositor) renderer.beginComposite(compositor, 'None', this.compositionOpacity);
    let isRendered = true;
    for (const paint of this.paints) isRendered = paint.render(renderer) && isRendered;
    if (compositor) renderer.endComposite(compositor);
    return isRendered;
  }

  /** `Scene::Impl::bounds(RenderMethod*)`: the children's regions merged, its right and bottom from 0. */
  region(renderer: RenderMethod): RenderRegion {
    if (this.paints.length === 0) return emptyRegion();
    let [x1, y1, x2, y2] = [INT32_MAX, INT32_MAX, 0, 0];
    for (const paint of this.paints) {
      const { x, y, w, h } = paint.region(renderer);
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x + w);
      y2 = Math.max(y2, y + h);
    }
    const region = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    intersectRegion(region, this.viewportOnUpdate);
    return region;
  }

  protected ownBounds(isStroking: boolean): Box | null {
    if (this.paints.length === 0) return null;
    let [x1, y1, x2, y2] = [FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX];
    for (const paint of this.paints) {
      const box = paint.bounds(true, isStroking);
      if (!box) continue;
      x1 = Math.min(x1, box.x);
      y1 = Math.min(y1, box.y);
      x2 = Math.max(x2, f32(box.x + box.w));
      y2 = Math.max(y2, f32(box.y + box.h));
    }
    return { x: x1, y: y1, w: f32(x2 - x1), h: f32(y2 - y1) };
  }

  duplicate(): Scene {
    const copy = this.copyPaintTo(new Scene());
    for (const paint of this.paints) copy.push(paint.duplicate());
    return copy;
  }
}

/** What a picture draws: a vector paint its loader builds, or a bitmap. */
export interface ImageLoader {
  /** The loaded size, which a vector loader sets again once it has read the whole document. */
  readonly w: number;
  readonly h: number;
  /** The vector paint, handed over once, or null for a bitmap. */
  paint(): Paint | null;
  bitmap(): RenderSurface | null;
  /** `resize`: sets `paint`'s transform to draw the loaded size at `w` by `h`. */
  resize(paint: Paint, w: number, h: number): void;
}

/** `Picture`: an image a loader reads, drawn at the size set on it. */
export class Picture extends Paint {
  readonly type = 'Picture';
  private paint: Paint | null = null;
  private surface: RenderSurface | null = null;
  private data: RenderData | null = null;
  private isResizing = false;
  private compositionFlag: number = CompositionFlag.Invalid;
  w: number;
  h: number;

  constructor(private readonly loader: ImageLoader) {
    super();
    this.w = loader.w;
    this.h = loader.h;
  }

  size(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.isResizing = true;
  }

  /** `Picture::Impl::load`: takes the loader's paint or bitmap the first time it is asked. */
  private load(): void {
    if (this.paint || this.surface) return;
    this.paint = this.loader.paint();
    if (this.paint) {
      if (this.w !== this.loader.w || this.h !== this.loader.h) {
        if (!this.isResizing) {
          this.w = this.loader.w;
          this.h = this.loader.h;
        }
        this.loader.resize(this.paint, this.w, this.h);
        this.isResizing = false;
      }
      return;
    }
    this.surface = this.loader.bitmap();
  }

  /** `Picture::Impl::queryComposition`: an opaque picture through a translucent mask needs a layer. */
  private queryComposition(opacity: number): void {
    this.compositionFlag = CompositionFlag.Invalid;
    if (opacity < 255 || !this.mask) return;
    if (this.mask.target.opacity === 255 || this.mask.target.opacity === 0) return;
    this.compositionFlag = CompositionFlag.Opacity;
  }

  protected prepareOwn(
    renderer: RenderMethod,
    transform: Matrix,
    clips: RenderData[],
    opacity: number
  ): RenderData | null {
    this.load();
    if (this.surface) {
      const scale = Math.min(f32(this.w / this.loader.w), f32(this.h / this.loader.h));
      const m = multiply(transform, { ...identityMatrix(), e11: scale, e22: scale });
      return (this.data = renderer.prepareImage(this.surface, this.data, m, clips, opacity));
    }
    if (!this.paint) return this.data;
    if (this.isResizing) {
      this.loader.resize(this.paint, this.w, this.h);
      this.isResizing = false;
    }
    this.queryComposition(opacity);
    return (this.data = this.paint.update(renderer, transform, clips, opacity, false));
  }

  protected renderOwn(renderer: RenderMethod): boolean {
    if (this.surface) return this.data ? renderer.renderImage(this.data) : false;
    if (!this.paint) return false;
    const compositor = this.compositionFlag
      ? renderer.target(this.region(renderer), renderer.colorSpace(), this.compositionFlag)
      : null;
    if (compositor) renderer.beginComposite(compositor, 'None', 255);
    const isRendered = this.paint.render(renderer);
    if (compositor) renderer.endComposite(compositor);
    return isRendered;
  }

  region(renderer: RenderMethod): RenderRegion {
    if (this.data) return renderer.region(this.data);
    return this.paint ? this.paint.region(renderer) : emptyRegion();
  }

  protected ownBounds(): Box {
    return { x: 0, y: 0, w: this.w, h: this.h };
  }

  duplicate(): Picture {
    this.load();
    const copy = this.copyPaintTo(new Picture(this.loader));
    copy.paint = this.paint && this.paint.duplicate();
    copy.surface = this.surface;
    copy.w = this.w;
    copy.h = this.h;
    copy.isResizing = this.isResizing;
    return copy;
  }
}

/**
 * `Text` with no font loader: Godot builds ThorVG with no TTF loader, so a text paint draws
 * nothing and has no bounds, but still counts as a paint where a scene decides on a layer.
 */
export class Text extends Paint {
  readonly type = 'Text';

  region(): RenderRegion {
    return emptyRegion();
  }

  protected ownBounds(): null {
    return null;
  }

  protected prepareOwn(): null {
    return null;
  }

  protected renderOwn(): boolean {
    return true;
  }

  duplicate(): Text {
    return this.copyPaintTo(new Text());
  }
}
