/**
 * The tree ThorVG's SVG loader builds (`tvgSvgLoaderCommon.h`): nodes with their style, transform
 * and per-type data, and the gradients they paint with. A node's data is a field per type where the
 * C++ keeps a union, and a node starts with the defaults `_createNode` gives it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Matrix } from './math';

export type SvgNodeType =
  | 'Doc'
  | 'G'
  | 'Defs'
  | 'Circle'
  | 'Ellipse'
  | 'Image'
  | 'Line'
  | 'Path'
  | 'Polygon'
  | 'Polyline'
  | 'Rect'
  | 'Text'
  | 'Use'
  | 'ClipPath'
  | 'Mask'
  | 'CssStyle'
  | 'Symbol';

/** `SvgFillFlags`, with ThorVG's `ClipPath = 0x16`, which shares bits with the others. */
export const SvgFillFlags = {
  Paint: 0x01,
  Opacity: 0x02,
  Gradient: 0x04,
  FillRule: 0x08,
  ClipPath: 0x16,
} as const;

export const SvgStrokeFlags = {
  Paint: 0x1,
  Opacity: 0x2,
  Gradient: 0x4,
  Scale: 0x8,
  Width: 0x10,
  Cap: 0x20,
  Join: 0x40,
  Dash: 0x80,
  Miterlimit: 0x100,
  DashOffset: 0x200,
} as const;

export const SvgStyleFlags = {
  Color: 0x01,
  Fill: 0x02,
  FillRule: 0x04,
  FillOpacity: 0x08,
  Opacity: 0x010,
  Stroke: 0x20,
  StrokeWidth: 0x40,
  StrokeLineJoin: 0x80,
  StrokeLineCap: 0x100,
  StrokeOpacity: 0x200,
  StrokeDashArray: 0x400,
  Transform: 0x800,
  ClipPath: 0x1000,
  Mask: 0x2000,
  MaskType: 0x4000,
  Display: 0x8000,
  PaintOrder: 0x10000,
  StrokeMiterlimit: 0x20000,
  StrokeDashOffset: 0x40000,
} as const;

export const SvgGradientFlags = {
  None: 0x0,
  GradientUnits: 0x1,
  SpreadMethod: 0x2,
  X1: 0x4,
  X2: 0x8,
  Y1: 0x10,
  Y2: 0x20,
  Cx: 0x40,
  Cy: 0x80,
  R: 0x100,
  Fx: 0x200,
  Fy: 0x400,
  Fr: 0x800,
} as const;

export const SvgViewFlag = {
  None: 0,
  Width: 0x01,
  Height: 0x02,
  Viewbox: 0x04,
  WidthInPercent: 0x08,
  HeightInPercent: 0x10,
} as const;

export type StrokeCap = 'Square' | 'Round' | 'Butt';
export type StrokeJoin = 'Bevel' | 'Round' | 'Miter';
export type FillRule = 'Winding' | 'EvenOdd';
export type FillSpread = 'Pad' | 'Reflect' | 'Repeat';
export type SvgMaskType = 'Luminance' | 'Alpha';

export type AspectRatioAlign =
  | 'None'
  | 'XMinYMin'
  | 'XMidYMin'
  | 'XMaxYMin'
  | 'XMinYMid'
  | 'XMidYMid'
  | 'XMaxYMid'
  | 'XMinYMax'
  | 'XMidYMax'
  | 'XMaxYMax';

export type AspectRatioMeetOrSlice = 'Meet' | 'Slice';

export interface SvgColor {
  r: number;
  g: number;
  b: number;
}

/** `Fill::ColorStop`: an offset and a straight colour. */
export interface ColorStop {
  offset: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SvgLinearGradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isX1Percentage: boolean;
  isY1Percentage: boolean;
  isX2Percentage: boolean;
  isY2Percentage: boolean;
}

export interface SvgRadialGradient {
  cx: number;
  cy: number;
  fx: number;
  fy: number;
  r: number;
  fr: number;
  isCxPercentage: boolean;
  isCyPercentage: boolean;
  isFxPercentage: boolean;
  isFyPercentage: boolean;
  isRPercentage: boolean;
  isFrPercentage: boolean;
}

export interface SvgStyleGradient {
  type: 'Linear' | 'Radial';
  id: string | null;
  ref: string | null;
  spread: FillSpread;
  radial: SvgRadialGradient | null;
  linear: SvgLinearGradient | null;
  transform: Matrix | null;
  stops: ColorStop[];
  flags: number;
  userSpace: boolean;
}

export interface SvgPaint {
  gradient: SvgStyleGradient | null;
  url: string | null;
  color: SvgColor;
  none: boolean;
  curColor: boolean;
}

export interface SvgComposite {
  url: string | null;
  node: SvgNode | null;
  /** Set while the composite is being built, which stops a circular reference. */
  applying: boolean;
}

export interface SvgStyleFill {
  flags: number;
  paint: SvgPaint;
  opacity: number;
  fillRule: FillRule;
}

export interface SvgStyleStroke {
  flags: number;
  paint: SvgPaint;
  opacity: number;
  scale: number;
  width: number;
  cap: StrokeCap;
  join: StrokeJoin;
  miterlimit: number;
  dash: { array: number[]; offset: number };
}

export interface SvgStyleProperty {
  fill: SvgStyleFill;
  stroke: SvgStyleStroke;
  clipPath: SvgComposite;
  mask: SvgComposite;
  opacity: number;
  color: SvgColor;
  cssClass: string | null;
  flags: number;
  /** The flags an `!important` declaration set, which a later declaration does not override. */
  flagsImportance: number;
  curColorSet: boolean;
  /** True for the default order, fill then stroke. */
  paintOrder: boolean;
  display: boolean;
}

export interface SvgDocNode {
  w: number;
  h: number;
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  viewFlag: number;
  defs: SvgNode | null;
  style: SvgNode | null;
  align: AspectRatioAlign;
  meetOrSlice: AspectRatioMeetOrSlice;
}

export interface SvgSymbolNode {
  w: number;
  h: number;
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  align: AspectRatioAlign;
  meetOrSlice: AspectRatioMeetOrSlice;
  overflowVisible: boolean;
  hasViewBox: boolean;
  hasWidth: boolean;
  hasHeight: boolean;
}

export interface SvgUseNode {
  x: number;
  y: number;
  w: number;
  h: number;
  isWidthSet: boolean;
  isHeightSet: boolean;
  symbol: SvgNode | null;
}

export interface SvgRectNode {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  ry: number;
  hasRx: boolean;
  hasRy: boolean;
}

export interface SvgTextNode {
  text: string | null;
  fontFamily: string | null;
  x: number;
  y: number;
  fontSize: number;
}

/** The fields of every node type, each zero as `calloc` leaves it until the node's factory sets it. */
export interface SvgNodeData {
  doc: SvgDocNode;
  defsGradients: SvgStyleGradient[];
  symbol: SvgSymbolNode;
  use: SvgUseNode;
  circle: { cx: number; cy: number; r: number };
  ellipse: { cx: number; cy: number; rx: number; ry: number };
  rect: SvgRectNode;
  line: { x1: number; y1: number; x2: number; y2: number };
  image: { x: number; y: number; w: number; h: number; href: string | null };
  path: string | null;
  points: number[];
  clip: { userSpace: boolean };
  mask: { type: SvgMaskType; userSpace: boolean };
  text: SvgTextNode;
}

export interface SvgNode {
  type: SvgNodeType;
  parent: SvgNode | null;
  child: SvgNode[];
  id: string | null;
  style: SvgStyleProperty;
  transform: Matrix | null;
  node: SvgNodeData;
}

const noPaint = (isNone: boolean): SvgPaint => ({
  gradient: null,
  url: null,
  color: { r: 0, g: 0, b: 0 },
  none: isNone,
  curColor: false,
});

const noComposite = (): SvgComposite => ({ url: null, node: null, applying: false });

/** The style `_createNode` gives a node: a black fill, no stroke and full opacity. */
function defaultStyle(): SvgStyleProperty {
  return {
    fill: { flags: 0, paint: noPaint(false), opacity: 255, fillRule: 'Winding' },
    stroke: {
      flags: 0,
      paint: noPaint(true),
      opacity: 255,
      scale: 1,
      width: 1,
      cap: 'Butt',
      join: 'Miter',
      miterlimit: 4,
      dash: { array: [], offset: 0 },
    },
    clipPath: noComposite(),
    mask: noComposite(),
    opacity: 255,
    color: { r: 0, g: 0, b: 0 },
    cssClass: null,
    flags: 0,
    flagsImportance: 0,
    curColorSet: false,
    paintOrder: true,
    display: true,
  };
}

function zeroData(): SvgNodeData {
  return {
    doc: {
      w: 0,
      h: 0,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
      viewFlag: 0,
      defs: null,
      style: null,
      align: 'None',
      meetOrSlice: 'Meet',
    },
    defsGradients: [],
    symbol: {
      w: 0,
      h: 0,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
      align: 'None',
      meetOrSlice: 'Meet',
      overflowVisible: false,
      hasViewBox: false,
      hasWidth: false,
      hasHeight: false,
    },
    use: { x: 0, y: 0, w: 0, h: 0, isWidthSet: false, isHeightSet: false, symbol: null },
    circle: { cx: 0, cy: 0, r: 0 },
    ellipse: { cx: 0, cy: 0, rx: 0, ry: 0 },
    rect: { x: 0, y: 0, w: 0, h: 0, rx: 0, ry: 0, hasRx: false, hasRy: false },
    line: { x1: 0, y1: 0, x2: 0, y2: 0 },
    image: { x: 0, y: 0, w: 0, h: 0, href: null },
    path: null,
    points: [],
    clip: { userSpace: false },
    mask: { type: 'Luminance', userSpace: false },
    text: { text: null, fontFamily: null, x: 0, y: 0, fontSize: 0 },
  };
}

/** `_createNode`: a node of `type` with the default style, appended to `parent`'s children. */
export function createNode(parent: SvgNode | null, type: SvgNodeType): SvgNode {
  const node: SvgNode = {
    type,
    parent,
    child: [],
    id: null,
    style: defaultStyle(),
    transform: null,
    node: zeroData(),
  };
  parent?.child.push(node);
  return node;
}
