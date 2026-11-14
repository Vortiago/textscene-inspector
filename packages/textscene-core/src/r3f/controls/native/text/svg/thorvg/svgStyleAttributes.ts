/**
 * The presentation attributes and `style` declarations ThorVG's SVG loader reads onto a node
 * (`tvgSvgLoader.cpp:980-1265`, `styleTags[]`). A `style` declaration marks its property set, which
 * keeps a later presentation attribute from overriding it, and `!important` keeps it over a later one.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { cssCopyStyleAttr, cssFindStyleNode, cssFindStyleNodeOfType } from './svgCssStyle';
import { SvgFillFlags, SvgStrokeFlags, SvgStyleFlags, type SvgNode, type SvgPaint } from './svgNode';
import {
  idFromUrl,
  parseDashArray,
  parseTransform,
  skipSpace,
  toColour,
  toFillRule,
  toLength,
  toLineCap,
  toLineJoin,
  toMaskType,
  toOpacity,
  toPaintOrder,
  type ViewGlobal,
} from './svgValues';
import { strToFloat } from './strToFloat';
import { isSpace } from './xmlParser';

/** What a style handler reads besides the node: the view a percentage refers to, and the style sheet. */
export interface StyleContext {
  readonly global: ViewGlobal;
  readonly cssStyle: SvgNode | null;
  /** Nodes whose class names a rule the style sheet does not hold yet. */
  readonly nodesToStyle: { node: SvgNode; id: string | null }[];
}

type StyleHandler = (context: StyleContext, node: SvgNode, value: string) => void;

/** `_handlePaintAttr`. */
function readPaint(paint: SvgPaint, value: string): void {
  if (value === 'none') {
    paint.none = true;
    return;
  }
  if (value === 'currentColor') {
    paint.curColor = true;
    paint.none = false;
    return;
  }
  const parsed = toColour(value, true);
  if (parsed.kind === 'none') return;
  if (parsed.kind === 'url') paint.url = parsed.id;
  else if (parsed.colour) paint.color = parsed.colour;
  paint.none = false;
}

/** `_copyId`: null for an empty id. */
export const copyId = (value: string | null): string | null => (value ? value : null);

/** `_handleCssClassAttr`: the class, and the rules for it, a typed rule before a class rule. */
export function readCssClass(context: StyleContext, node: SvgNode, value: string): void {
  const cssClass = copyId(value);
  node.style.cssClass = cssClass;
  let isFound = false;
  const typed = cssFindStyleNodeOfType(context.cssStyle, cssClass, node.type);
  if (typed) {
    isFound = true;
    cssCopyStyleAttr(node, typed);
  }
  const classed = cssFindStyleNode(context.cssStyle, cssClass);
  if (classed) {
    isFound = true;
    cssCopyStyleAttr(node, classed);
  }
  if (!isFound) context.nodesToStyle.push({ node, id: cssClass });
}

/** `_handleClipPathAttr` and `_handleMaskAttr`: a `url(#id)` reference. */
export function readClipPath(_context: StyleContext, node: SvgNode, value: string): void {
  if (value.length >= 3 && value.startsWith('url')) node.style.clipPath.url = idFromUrl(value.slice(3));
}

export function readMask(_context: StyleContext, node: SvgNode, value: string): void {
  if (value.length >= 3 && value.startsWith('url')) node.style.mask.url = idFromUrl(value.slice(3));
}

const STYLE_HANDLERS: readonly (readonly [string, StyleHandler, number])[] = [
  [
    'color',
    (_c, node, value) => {
      const parsed = toColour(value, false);
      if (parsed.kind !== 'colour') return;
      if (parsed.colour) node.style.color = parsed.colour;
      node.style.curColorSet = true;
    },
    SvgStyleFlags.Color,
  ],
  [
    'fill',
    (_c, node, value) => {
      node.style.fill.flags |= SvgFillFlags.Paint;
      readPaint(node.style.fill.paint, value);
    },
    SvgStyleFlags.Fill,
  ],
  [
    'fill-rule',
    (_c, node, value) => {
      node.style.fill.flags |= SvgFillFlags.FillRule;
      node.style.fill.fillRule = toFillRule(value);
    },
    SvgStyleFlags.FillRule,
  ],
  [
    'fill-opacity',
    (_c, node, value) => {
      node.style.fill.flags |= SvgFillFlags.Opacity;
      node.style.fill.opacity = toOpacity(value);
    },
    SvgStyleFlags.FillOpacity,
  ],
  [
    'opacity',
    (_c, node, value) => {
      node.style.flags |= SvgStyleFlags.Opacity;
      node.style.opacity = toOpacity(value);
    },
    SvgStyleFlags.Opacity,
  ],
  [
    'stroke',
    (_c, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Paint;
      readPaint(node.style.stroke.paint, value);
    },
    SvgStyleFlags.Stroke,
  ],
  [
    'stroke-width',
    (context, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Width;
      node.style.stroke.width = toLength(context.global, value, 'Diagonal');
    },
    SvgStyleFlags.StrokeWidth,
  ],
  [
    'stroke-linejoin',
    (_c, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Join;
      node.style.stroke.join = toLineJoin(value);
    },
    SvgStyleFlags.StrokeLineJoin,
  ],
  [
    'stroke-miterlimit',
    (_c, node, value) => {
      const miterlimit = strToFloat(value).value;
      // A negative miter limit is an illegal value (SVG 2, `stroke-miterlimit`), and ThorVG drops it.
      if (miterlimit < 0) return;
      node.style.stroke.flags |= SvgStrokeFlags.Miterlimit;
      node.style.stroke.miterlimit = miterlimit;
    },
    SvgStyleFlags.StrokeMiterlimit,
  ],
  [
    'stroke-linecap',
    (_c, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Cap;
      node.style.stroke.cap = toLineCap(value);
    },
    SvgStyleFlags.StrokeLineCap,
  ],
  [
    'stroke-opacity',
    (_c, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Opacity;
      node.style.stroke.opacity = toOpacity(value);
    },
    SvgStyleFlags.StrokeOpacity,
  ],
  [
    'stroke-dasharray',
    (context, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.Dash;
      parseDashArray(context.global, value, node.style.stroke.dash.array);
    },
    SvgStyleFlags.StrokeDashArray,
  ],
  [
    'stroke-dashoffset',
    (context, node, value) => {
      node.style.stroke.flags |= SvgStrokeFlags.DashOffset;
      node.style.stroke.dash.offset = toLength(context.global, value, 'Horizontal');
    },
    SvgStyleFlags.StrokeDashOffset,
  ],
  [
    'transform',
    (_c, node, value) => {
      node.transform = parseTransform(value);
    },
    SvgStyleFlags.Transform,
  ],
  ['clip-path', readClipPath, SvgStyleFlags.ClipPath],
  ['mask', readMask, SvgStyleFlags.Mask],
  [
    'mask-type',
    (_c, node, value) => {
      // ThorVG writes the union's mask field whatever the node is; only a mask reads it.
      node.node.mask.type = toMaskType(value);
    },
    SvgStyleFlags.MaskType,
  ],
  [
    'display',
    (_c, node, value) => {
      node.style.flags |= SvgStyleFlags.Display;
      node.style.display = value !== 'none';
    },
    SvgStyleFlags.Display,
  ],
  [
    'paint-order',
    (_c, node, value) => {
      node.style.flags |= SvgStyleFlags.PaintOrder;
      node.style.paintOrder = toPaintOrder(value);
    },
    SvgStyleFlags.PaintOrder,
  ],
];

const IMPORTANT = '!important';

/**
 * `_parseStyleAttr`: a declaration from a `style` attribute where `isStyle`, else a presentation
 * attribute, which applies only while no declaration set the property. False for a key it does not know.
 */
export function parseStyleAttr(
  context: StyleContext,
  node: SvgNode,
  key: string,
  value: string,
  isStyle: boolean
): boolean {
  key = key.slice(skipSpace(key, 0));
  value = value.slice(skipSpace(value, 0));
  const entry = STYLE_HANDLERS.find(([tag]) => tag === key);
  if (!entry) return false;
  const [, handler, flag] = entry;
  const important = value.indexOf(IMPORTANT);
  const isImportant = important >= 0;
  if (isImportant) {
    let size = important;
    while (size > 0 && isSpace(value[size - 1])) size--;
    value = value.slice(0, size);
  }
  if (isStyle) {
    if (isImportant || !(node.style.flagsImportance & flag)) {
      handler(context, node, value);
      node.style.flags |= flag;
    }
  } else if (!(node.style.flags & flag)) {
    handler(context, node, value);
  }
  // ThorVG takes the flags as they now stand, not the importance flags, and adds this one.
  if (isImportant) node.style.flagsImportance = node.style.flags | flag;
  return true;
}
