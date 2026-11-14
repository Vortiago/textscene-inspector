/**
 * ThorVG's SVG scene builder (`tvgSvgSceneBuilder.cpp`): the paint tree of a parsed document, each
 * element a shape, scene, picture or text with its style, clip and mask applied, inside a layer
 * that clips to the document's size. Every value stays in single precision, as ThorVG computes it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import {
  f32,
  identityMatrix,
  inverse,
  isEqual,
  isIdentity,
  isZero,
  matrix,
  multiply,
  transformPoint,
  translateR,
  type Matrix,
} from './math';
import { linearGradient, radialGradient, setRadial, type Fill, type FillColorStop } from './fill';
import { Picture, Scene, Shape, Text, type Box, type ImageLoader, type Paint } from './paint';
import { svgPathToShape } from './svgPath';
import {
  SvgViewFlag,
  type AspectRatioAlign,
  type AspectRatioMeetOrSlice,
  type SvgNode,
  type SvgStyleGradient,
} from './svgNode';
import { decodeBase64, decodeUrl } from './dataUri';

/** Opens an image an `image` element embeds, or null for a type or data no loader reads. */
export type ImageOpener = (bytes: Uint8Array, mimeType: string) => ImageLoader | null;

/** `_sceneBuildHelper` stops past this depth, as ThorVG guards a reference loop. */
const MAX_BUILD_DEPTH = 2192;

const GROUP_TYPES: ReadonlySet<SvgNode['type']> = new Set(['Doc', 'G', 'Use', 'ClipPath', 'Symbol']);

/** Whether every shape a mask holds draws white, which makes a luminance mask an alpha mask. */
interface MaskWhiteness {
  isWhite: boolean;
}

interface BuildContext {
  readonly openImage: ImageOpener;
}

/** The size and view box the document is drawn at (`SvgLoader`'s `w`, `h`, `vx`, `vy`, `vw`, `vh`). */
export interface SceneView {
  vBox: Box;
  w: number;
  h: number;
  readonly align: AspectRatioAlign;
  readonly meetOrSlice: AspectRatioMeetOrSlice;
  readonly viewFlag: number;
}

/**
 * `svgSceneBuild`: the root scene of `doc`, or null for a tree with no document. Where the document
 * has no view box, the view box and size become the scene's bounds, written back into `view`.
 */
export function svgSceneBuild(doc: SvgNode, view: SceneView, openImage: ImageOpener): Scene | null {
  if (doc.type !== 'Doc') return null;
  const context: BuildContext = { openImage };
  const docNode = buildScene(context, doc, view.vBox, false, 0, null);
  if (!docNode) return null;
  if (!(view.viewFlag & SvgViewFlag.Viewbox)) updateInvalidViewSize(docNode, view);
  const { vBox, w, h } = view;
  if (!isEqual(w, vBox.w) || !isEqual(h, vBox.h))
    docNode.transform(aspectRatioMatrix(view.align, view.meetOrSlice, w, h, vBox));
  else if (!isZero(vBox.x) || !isZero(vBox.y)) docNode.translate(-vBox.x, -vBox.y);
  const viewBoxClip = new Shape();
  viewBoxClip.appendRect(0, 0, w, h, 0, 0);
  const compositeLayer = new Scene();
  compositeLayer.clip(viewBoxClip);
  compositeLayer.push(docNode);
  const root = new Scene();
  root.push(compositeLayer);
  Object.assign(doc.node.doc, { vx: vBox.x, vy: vBox.y, vw: vBox.w, vh: vBox.h, w, h });
  return root;
}

/** `_updateInvalidViewSize`: the view box from the scene's bounds, and a size of 1 or a percentage scaled by it. */
function updateInvalidViewSize(scene: Scene, view: SceneView): void {
  const hasWidth = (view.viewFlag & SvgViewFlag.Width) !== 0;
  const hasHeight = (view.viewFlag & SvgViewFlag.Height) !== 0;
  // An empty scene leaves the box as it was; ThorVG then reads an unset x and y, taken here as 0.
  const bounds = scene.bounds(false, true) ?? { x: 0, y: 0, w: view.vBox.w, h: view.vBox.h };
  view.vBox.w = bounds.w;
  view.vBox.h = bounds.h;
  if (!hasWidth && !hasHeight) {
    view.vBox.x = bounds.x;
    view.vBox.y = bounds.y;
  } else {
    if (hasWidth) view.vBox.w = view.w;
    if (hasHeight) view.vBox.h = view.h;
  }
  if (!hasWidth) view.w = f32(view.w * view.vBox.w);
  if (!hasHeight) view.h = f32(view.h * view.vBox.h);
}

/** `_sceneBuildHelper`: a group's scene, or null for a node that is no group, past the depth limit. */
function buildScene(
  context: BuildContext,
  node: SvgNode,
  vBox: Box,
  isMask: boolean,
  depth: number,
  maskWhiteness: MaskWhiteness | null
): Scene | null {
  if (depth > MAX_BUILD_DEPTH) return null;
  if (!GROUP_TYPES.has(node.type) && !isMask) return null;
  const scene = new Scene();
  // A symbol's view box transform comes first, so `sceneOfUse` sets its transform.
  if (!isMask && node.transform && node.type !== 'Symbol') scene.transform(node.transform);
  if (!node.style.display || node.style.opacity === 0) return scene;
  for (const child of node.child) scene.push(buildChild(context, node, child, vBox, depth, maskWhiteness));
  applyComposition(context, scene, node, vBox);
  scene.opacity = node.style.opacity;
  return scene;
}

function buildChild(
  context: BuildContext,
  parent: SvgNode,
  child: SvgNode,
  vBox: Box,
  depth: number,
  maskWhiteness: MaskWhiteness | null
): Paint | null {
  if (GROUP_TYPES.has(child.type)) {
    if (child.type === 'Use') return sceneOfUse(context, child, vBox, depth + 1, maskWhiteness);
    // A symbol draws only through a `use`.
    if (child.type === 'Symbol' && parent.type !== 'Use') return null;
    return buildScene(context, child, vBox, false, depth + 1, maskWhiteness);
  }
  if (child.type === 'Image') {
    const image = imagePicture(context, child, vBox);
    if (image && maskWhiteness) maskWhiteness.isWhite = false;
    return image;
  }
  if (child.type === 'Text') return textPaint(context, child, vBox);
  if (child.type === 'Mask') return null;
  const shape = new Shape();
  if (!appendShape(context, child, shape, vBox)) return null;
  if (maskWhiteness && !isWhiteShape(shape)) maskWhiteness.isWhite = false;
  return shape;
}

/** Whether a shape fills and strokes in plain white. A shape whose stroke has no colour set strokes black. */
function isWhiteShape({ rs }: Shape): boolean {
  if (rs.fill || rs.color.slice(0, 3).some((channel) => channel < 255)) return false;
  if (!rs.stroke) return true;
  return !rs.stroke.fill && rs.stroke.color.slice(0, 3).every((channel) => channel === 255);
}

/** `_useBuildHelper`: the scene a `use` draws, through its symbol's view box and clip where it names one. */
function sceneOfUse(
  context: BuildContext,
  node: SvgNode,
  vBox: Box,
  depth: number,
  maskWhiteness: MaskWhiteness | null
): Scene | null {
  const scene = buildScene(context, node, vBox, false, depth + 1, maskWhiteness);
  if (!scene) return null;
  const use = node.node.use;
  let useTransform = node.transform ? { ...node.transform } : identityMatrix();
  if (use.x !== 0 || use.y !== 0)
    useTransform = multiply(useTransform, matrix(1, 0, use.x, 0, 1, use.y, 0, 0, 1));
  if (use.symbol) return symbolScene(scene, node, use.symbol, useTransform, vBox);
  const clipper = scene.clipper;
  if (clipper) {
    let clipTransform = clipper.m;
    const inv = node.transform && inverse(node.transform);
    if (inv) clipTransform = multiply(inv, clipTransform);
    clipper.transform(multiply(useTransform, clipTransform));
  }
  scene.transform(useTransform);
  return scene;
}

/** A `use` of a symbol: its view box fitted to the use's size, and clipped to it unless its overflow shows. */
function symbolScene(
  scene: Scene,
  node: SvgNode,
  symbolNode: SvgNode,
  useTransform: Matrix,
  vBox: Box
): Scene {
  const use = node.node.use;
  const symbol = symbolNode.node.symbol;
  const width = use.isWidthSet ? use.w : symbol.hasWidth ? symbol.w : vBox.w;
  const height = use.isHeightSet ? use.h : symbol.hasHeight ? symbol.h : vBox.h;
  const vw = symbol.hasViewBox ? symbol.vw : width;
  const vh = symbol.hasViewBox ? symbol.vh : height;
  let viewBox = identityMatrix();
  if ((!isEqual(width, vw) || !isEqual(height, vh)) && vw > 0 && vh > 0)
    viewBox = aspectRatioMatrix(symbol.align, symbol.meetOrSlice, width, height, {
      x: symbol.vx,
      y: symbol.vy,
      w: vw,
      h: vh,
    });
  else if (!isZero(symbol.vx) || !isZero(symbol.vy))
    viewBox = matrix(1, 0, -symbol.vx, 0, 1, -symbol.vy, 0, 0, 1);
  const symbolTransform = symbolNode.transform;
  const sceneTransform = symbolTransform ? multiply(symbolTransform, viewBox) : viewBox;
  scene.transform(multiply(useTransform, sceneTransform));
  if (symbol.overflowVisible) return scene;
  const viewBoxClip = new Shape();
  viewBoxClip.appendRect(0, 0, width, height, 0, 0);
  viewBoxClip.transform(symbolTransform ? multiply(useTransform, symbolTransform) : useTransform);
  const clippingLayer = new Scene();
  clippingLayer.clip(viewBoxClip);
  clippingLayer.push(scene);
  return clippingLayer;
}

/** `_calculateAspectRatioMatrix`: the transform that fits `box` into `width` by `height` as `preserveAspectRatio` says. */
function aspectRatioMatrix(
  align: AspectRatioAlign,
  meetOrSlice: AspectRatioMeetOrSlice,
  width: number,
  height: number,
  box: Box
): Matrix {
  let sx = f32(width / box.w);
  let sy = f32(height / box.h);
  if (align === 'None') return matrix(sx, 0, -f32(box.x * sx), 0, sy, -f32(box.y * sy), 0, 0, 1);
  if ((meetOrSlice === 'Meet') === sx < sy) sy = sx;
  else sx = sy;
  let tvx = f32(box.x * sx);
  let tvy = f32(box.y * sy);
  const spareX = f32(width - f32(box.w * sx));
  const spareY = f32(height - f32(box.h * sy));
  if (align.startsWith('XMid')) tvx = f32(tvx - f32(spareX * 0.5));
  else if (align.startsWith('XMax')) tvx = f32(tvx - spareX);
  if (align.endsWith('YMid')) tvy = f32(tvy - f32(spareY * 0.5));
  else if (align.endsWith('YMax')) tvy = f32(tvy - spareY);
  return matrix(sx, 0, -tvx, 0, sy, -tvy, 0, 0, 1);
}

/** `_recognizeShape`: appends the outline of a basic shape, or false for a node that is none. */
function recognizeShape(node: SvgNode, shape: Shape): boolean {
  const data = node.node;
  switch (node.type) {
    case 'Path':
      return data.path === null || svgPathToShape(data.path, shape.rs.path);
    case 'Ellipse':
      shape.appendCircle(data.ellipse.cx, data.ellipse.cy, data.ellipse.rx, data.ellipse.ry);
      return true;
    case 'Polygon':
    case 'Polyline': {
      const pts = data.points;
      if (pts.length < 2) return true;
      shape.moveTo(pts[0]!, pts[1]!);
      for (let at = 2; at + 1 < pts.length; at += 2) shape.lineTo(pts[at]!, pts[at + 1]!);
      if (node.type === 'Polygon') shape.close();
      return true;
    }
    case 'Circle':
      shape.appendCircle(data.circle.cx, data.circle.cy, data.circle.r, data.circle.r);
      return true;
    case 'Rect':
      shape.appendRect(data.rect.x, data.rect.y, data.rect.w, data.rect.h, data.rect.rx, data.rect.ry);
      return true;
    case 'Line':
      shape.moveTo(data.line.x1, data.line.y1);
      shape.lineTo(data.line.x2, data.line.y2);
      return true;
    default:
      return false;
  }
}

function appendShape(context: BuildContext, node: SvgNode, shape: Shape, vBox: Box): boolean {
  if (!recognizeShape(node, shape)) return false;
  applyProperty(context, node, shape, vBox, false);
  return true;
}

/** `_appendClipShape`: appends a clip child's outline to the clip shape, its points through `transform` or its own. */
function appendClipShape(
  context: BuildContext,
  node: SvgNode,
  shape: Shape,
  vBox: Box,
  transform: Matrix | null
): boolean {
  const m = transform ?? node.transform;
  const pts = shape.rs.path.pts;
  const firstPoint = pts.length;
  if (!recognizeShape(node, shape)) return false;
  if (m) for (let at = firstPoint; at < pts.length; at++) pts[at] = transformPoint(pts[at]!, m);
  applyProperty(context, node, shape, vBox, true);
  return true;
}

/** `_appendClipUseNode`: a `use` in a clip path draws only the one basic shape it holds. */
function appendClipUse(context: BuildContext, node: SvgNode, shape: Shape, vBox: Box): boolean {
  if (node.child.length !== 1) return false;
  const child = node.child[0]!;
  let transform = node.transform ? { ...node.transform } : identityMatrix();
  const use = node.node.use;
  if (use.x !== 0 || use.y !== 0) transform = multiply(transform, matrix(1, 0, use.x, 0, 1, use.y, 0, 0, 1));
  if (child.transform) transform = multiply(transform, child.transform);
  return appendClipShape(context, child, shape, vBox, isIdentity(transform) ? null : transform);
}

/** `_boundingBox` of a shape: its path's box, the stroke ThorVG adds taken out again. No points read as 0. */
function shapeBoundingBox(shape: Shape): Box {
  const box = shape.bounds(false, true) ?? { x: 0, y: 0, w: 0, h: 0 };
  const strokeWidth = shape.rs.stroke?.width ?? 0;
  if (!strokeWidth) return box;
  const half = f32(0.5 * strokeWidth);
  return {
    x: f32(box.x + half),
    y: f32(box.y + half),
    w: f32(box.w - strokeWidth),
    h: f32(box.h - strokeWidth),
  };
}

/** `_transformMultiply`: the gradient transform scaled and moved into the bounding box. */
function transformIntoBox(box: Matrix, m: Matrix): void {
  m.e13 = f32(f32(m.e13 * box.e11) + box.e13);
  m.e12 = f32(m.e12 * box.e11);
  m.e11 = f32(m.e11 * box.e11);
  m.e23 = f32(f32(m.e23 * box.e22) + box.e23);
  m.e22 = f32(m.e22 * box.e22);
  m.e21 = f32(m.e21 * box.e22);
}

/** The gradient's transform, with an object bounding box gradient's box folded in (`_apply*GradientProperty`). */
function gradientTransform(g: SvgStyleGradient, box: Box): Matrix | null {
  if (g.userSpace) return g.transform && { ...g.transform };
  const boxMatrix = matrix(box.w, 0, box.x, 0, box.h, box.y, 0, 0, 1);
  if (!g.transform) return boxMatrix;
  const m = { ...g.transform };
  transformIntoBox(boxMatrix, m);
  return m;
}

/**
 * The stops a gradient draws: each alpha scaled by the paint's opacity, and each offset held to
 * at least the one before and at most 1 (SVG 2, "Notes on gradients").
 */
function gradientStops(g: SvgStyleGradient, opacity: number): FillColorStop[] {
  let previous = 0;
  return g.stops.map((stop) => {
    const offset = stop.offset < previous ? previous : stop.offset > 1 ? 1 : stop.offset;
    previous = offset;
    return { offset, r: stop.r, g: stop.g, b: stop.b, a: Math.trunc((stop.a * opacity) / 255) & 0xff };
  });
}

/**
 * `_applyLinearGradientProperty` and `_applyRadialGradientProperty`. A user space gradient scales
 * its own coordinates by the box in place, as ThorVG does.
 */
function gradientFill(g: SvgStyleGradient, box: Box, opacity: number): Fill | null {
  if (g.type === 'Linear' && g.linear) {
    const linear = g.linear;
    if (g.userSpace) {
      linear.x1 = f32(linear.x1 * box.w);
      linear.y1 = f32(linear.y1 * box.h);
      linear.x2 = f32(linear.x2 * box.w);
      linear.y2 = f32(linear.y2 * box.h);
    }
    const fill = linearGradient();
    Object.assign(fill, { x1: linear.x1, y1: linear.y1, x2: linear.x2, y2: linear.y2 });
    return finishGradient(fill, g, box, opacity);
  }
  if (g.type === 'Radial' && g.radial) {
    const radial = g.radial;
    if (g.userSpace) {
      radial.cx = f32(radial.cx * box.w);
      radial.cy = f32(radial.cy * box.h);
      radial.r = scaleByDiagonal(radial.r, box);
      radial.fx = f32(radial.fx * box.w);
      radial.fy = f32(radial.fy * box.h);
      radial.fr = scaleByDiagonal(radial.fr, box);
    }
    const fill = radialGradient();
    setRadial(fill, radial.cx, radial.cy, radial.r, radial.fx, radial.fy, radial.fr);
    return finishGradient(fill, g, box, opacity);
  }
  return null;
}

/** A radius in user space, scaled by the box's diagonal over the square root of two. */
const scaleByDiagonal = (radius: number, box: Box): number =>
  f32(f32(radius * f32(Math.sqrt(f32(f32(box.w * box.w) + f32(box.h * box.h))))) / f32(Math.SQRT2));

function finishGradient(fill: Fill, g: SvgStyleGradient, box: Box, opacity: number): Fill {
  fill.transform = gradientTransform(g, box);
  fill.spread = g.spread;
  fill.stops = gradientStops(g, opacity);
  return fill;
}

/** `_applyProperty`: the node's transform, fill, opacity, stroke, clip and mask, set on its shape. */
function applyProperty(context: BuildContext, node: SvgNode, vg: Shape, vBox: Box, isClip: boolean): void {
  const style = node.style;
  // A clip child's transform is already in its points.
  if (node.transform && !isClip) vg.transform(node.transform);
  if (node.type === 'Doc' || !style.display) return;
  const fill = style.fill;
  if (!fill.paint.none) {
    const gradient = fill.paint.gradient;
    if (gradient) {
      const box = gradient.userSpace ? vBox : shapeBoundingBox(vg);
      const filling = gradientFill(gradient, box, fill.opacity);
      if (filling) vg.fillGradient(filling);
    } else if (fill.paint.url) {
      // ThorVG draws no fill for a URL that names no gradient.
    } else {
      const { r, g, b } = fill.paint.curColor ? style.color : fill.paint.color;
      vg.fillColor(r, g, b, fill.opacity);
    }
  }
  vg.fillRule(fill.fillRule);
  vg.order(!style.paintOrder);
  if (style.opacity < 255) vg.opacity = style.opacity;
  const stroke = style.stroke;
  vg.strokeWidth(stroke.width);
  vg.strokeCap(stroke.cap);
  vg.strokeJoin(stroke.join);
  vg.strokeMiterlimit(stroke.miterlimit);
  if (stroke.dash.array.length > 0) vg.strokeDash(stroke.dash.array, stroke.dash.offset);
  if (stroke.paint.none) vg.strokeWidth(0);
  else if (stroke.paint.gradient) {
    const box = stroke.paint.gradient.userSpace ? vBox : shapeBoundingBox(vg);
    const filling = gradientFill(stroke.paint.gradient, box, stroke.opacity);
    if (filling) vg.strokeGradient(filling);
  } else if (!stroke.paint.url) {
    const { r, g, b } = stroke.paint.curColor ? style.color : stroke.paint.color;
    vg.strokeColor(r, g, b, stroke.opacity);
  }
  applyComposition(context, vg, node, vBox);
}

/** `_compositionTransform`: the clip or mask's transform, in the paint's bounding box for object units. */
function compositionTransform(paint: Paint, node: SvgNode, compNode: SvgNode, isMask: boolean): Matrix {
  // SVG ignores the masked node's own transform for the mask.
  let m = node.transform && !isMask ? { ...node.transform } : identityMatrix();
  if (compNode.transform) m = multiply(m, compNode.transform);
  if (!compNode.node.clip.userSpace) {
    const box = paint.bounds(false, false) ?? { x: 0, y: 0, w: 0, h: 0 };
    m = multiply(m, matrix(box.w, 0, box.x, 0, box.h, box.y, 0, 0, 1));
  }
  return m;
}

/** `_applyComposition`: the node's clip path and mask set on `paint`, each built once while a loop applies them. */
function applyComposition(context: BuildContext, paint: Paint, node: SvgNode, vBox: Box): void {
  const clipPath = node.style.clipPath;
  const clipNode = clipPath.node;
  if (!clipPath.applying && clipNode && clipNode.child.length > 0) {
    clipPath.applying = true;
    const comp = new Shape();
    let isValid = false;
    for (const child of clipNode.child) {
      const isAppended =
        child.type === 'Use'
          ? appendClipUse(context, child, comp, vBox)
          : appendClipShape(context, child, comp, vBox, null);
      if (isAppended) isValid = true;
    }
    if (isValid) {
      comp.transform(compositionTransform(paint, node, clipNode, false));
      paint.clip(comp);
    }
    clipPath.applying = false;
  }
  const mask = node.style.mask;
  const maskNode = mask.node;
  if (!mask.applying && maskNode && maskNode.child.length > 0) {
    mask.applying = true;
    const whiteness: MaskWhiteness = { isWhite: true };
    const comp = buildScene(context, maskNode, vBox, true, 0, whiteness);
    if (comp) {
      if (!maskNode.node.mask.userSpace) comp.transform(compositionTransform(paint, node, maskNode, true));
      else if (node.transform) comp.transform(node.transform);
      paint.composite(
        comp,
        maskNode.node.mask.type === 'Luminance' && !whiteness.isWhite ? 'LumaMask' : 'AlphaMask'
      );
    }
    mask.applying = false;
  }
}

/** `_textBuildHelper`: a text paint, which draws nothing with no font loader but keeps its place. */
function textPaint(context: BuildContext, node: SvgNode, vBox: Box): Text | null {
  const text = node.node.text;
  if (text.text === null) return null;
  const paint = new Text();
  const m = node.transform ? { ...node.transform } : identityMatrix();
  translateR(m, text.x, f32(text.y - text.fontSize));
  paint.transform(m);
  const fill = node.style.fill;
  if (!fill.paint.none && !fill.paint.gradient && !fill.paint.url) paint.opacity = fill.opacity;
  applyComposition(context, paint, node, vBox);
  return paint;
}

/** The media types an `image` element's data URI may name, and the encodings each takes. */
const IMAGE_MIME_TYPES = [
  { name: 'jpeg', base64: true, utf8: false },
  { name: 'png', base64: true, utf8: false },
  { name: 'webp', base64: true, utf8: false },
  { name: 'svg+xml', base64: true, utf8: true },
] as const;

/** `_isValidImageMimeTypeAndEncoding`: the media type, encoding and data of a data URI's rest. */
function readImageDataUri(
  href: string
): { mimeType: string; encoding: 'base64' | 'utf8'; data: string } | null {
  if (!href.startsWith('image/')) return null;
  let at = 'image/'.length;
  const type = IMAGE_MIME_TYPES.find((candidate) => href.startsWith(candidate.name, at));
  if (!type) return null;
  at += type.name.length;
  while (at < href.length && href[at] !== ',') {
    while (at < href.length && href[at] !== ';') at++;
    if (at >= href.length) return null;
    at++;
    if (type.base64 && href.startsWith('base64,', at))
      return { mimeType: type.name, encoding: 'base64', data: href.slice(at + 7) };
    if (type.utf8 && href.startsWith('utf8,', at))
      return { mimeType: type.name, encoding: 'utf8', data: href.slice(at + 5) };
  }
  if (href[at] === ',' && type.utf8)
    return { mimeType: type.name, encoding: 'utf8', data: href.slice(at + 1) };
  return null;
}

/**
 * `_imageBuildHelper`: a picture of the image a data URI embeds, fitted to the element's box. A
 * path to a file loads nothing here: the player's files are out of reach of a browser.
 */
function imagePicture(context: BuildContext, node: SvgNode, vBox: Box): Picture | null {
  const image = node.node.image;
  if (!image.href || !image.href.startsWith('data:')) return null;
  const uri = readImageDataUri(image.href.slice('data:'.length));
  if (!uri) return null;
  const bytes = uri.encoding === 'base64' ? decodeBase64(uri.data) : decodeUrl(uri.data);
  const loader = context.openImage(bytes, uri.mimeType);
  if (!loader) return null;
  const picture = new Picture(loader);
  let m = identityMatrix();
  if (picture.w > 0 && picture.h > 0)
    m = matrix(f32(image.w / picture.w), 0, image.x, 0, f32(image.h / picture.h), image.y, 0, 0, 1);
  if (node.transform) m = multiply(node.transform, m);
  picture.transform(m);
  applyComposition(context, picture, node, vBox);
  return picture;
}
