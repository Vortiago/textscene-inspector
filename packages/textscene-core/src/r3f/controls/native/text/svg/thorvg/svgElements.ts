/**
 * The element factories of ThorVG's SVG loader (`tvgSvgLoader.cpp:928-2297`): each element's
 * attributes read onto a new node, with the defaults its factory sets first. An attribute an element
 * does not know is read as a presentation attribute.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { FLOAT_EPSILON } from './math';
import { createNode, SvgViewFlag, type SvgNode, type SvgNodeType } from './svgNode';
import {
  copyId,
  parseStyleAttr,
  readClipPath,
  readCssClass,
  readMask,
  type StyleContext,
} from './svgStyleAttributes';
import {
  idFromHref,
  parseAspectRatio,
  parseNumber,
  parseTransform,
  srcFromUrl,
  toLength,
  toMaskType,
  type LengthType,
  type ViewGlobal,
} from './svgValues';
import { simpleXmlParseW3CAttribute, type SimpleXmlAttributeCallback } from './xmlParser';

/** The loader state an element's attributes read and write. */
export interface ElementContext extends StyleContext {
  readonly global: ViewGlobal;
  /** The `@font-face` rules of the style sheet, which ThorVG cannot load without a font loader. */
  readonly fonts: { name: string | null; src: string | null }[];
  /** Resolves a `use` reference as its `href` attribute is read. */
  readonly readUseHref: (node: SvgNode, value: string) => void;
}

/** Reads an element's attribute text, as a tag's attributes or as a CSS rule's declarations. */
export type AttributeParser = (text: string, callback: SimpleXmlAttributeCallback) => boolean;

export type ElementFactory = (
  context: ElementContext,
  parent: SvgNode | null,
  attributes: string,
  parse: AttributeParser
) => SvgNode;

/** The attributes most elements share: `style`, `id`, `class`, `clip-path`, `mask` and presentation attributes. */
function readCommon(
  context: ElementContext,
  node: SvgNode,
  key: string,
  value: string,
  options: { transform?: boolean } = {}
): boolean {
  if (key === 'style') return readStyle(context, node, value);
  if (options.transform && key === 'transform') {
    node.transform = parseTransform(value);
  } else if (key === 'id') {
    node.id = copyId(value);
  } else if (key === 'class') {
    readCssClass(context, node, value);
  } else if (key === 'clip-path') {
    readClipPath(context, node, value);
  } else if (key === 'mask') {
    readMask(context, node, value);
  } else {
    return parseStyleAttr(context, node, key, value, false);
  }
  return true;
}

/** A `style` attribute's declarations. */
function readStyle(context: ElementContext, node: SvgNode, value: string): boolean {
  return simpleXmlParseW3CAttribute(value, (key, declaration) =>
    parseStyleAttr(context, node, key, declaration, true)
  );
}

/** Lengths keyed by attribute name, written to `target`. */
function readLength(
  context: ElementContext,
  target: object,
  lengths: Readonly<Record<string, readonly [field: string, type: LengthType]>>,
  key: string,
  value: string
): boolean {
  if (!Object.hasOwn(lengths, key)) return false;
  const [field, type] = lengths[key]!;
  (target as Record<string, number>)[field] = toLength(context.global, value, type);
  return true;
}

/** `_attrParseGNode`, which `use` and `symbol` fall back to. */
function readGroupAttribute(context: ElementContext, node: SvgNode, key: string, value: string): boolean {
  return readCommon(context, node, key, value, { transform: true });
}

const createG: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'G');
  parse(attributes, (key, value) => readGroupAttribute(context, node, key, value));
  return node;
};

/** `_attrParseSvgNode`: the size and view box set the view percentages refer to. */
function readSvgAttribute(context: ElementContext, node: SvgNode, key: string, value: string): boolean {
  const doc = node.node.doc;
  const global = context.global;
  if (key === 'width') {
    doc.w = toLength(global, value, 'Horizontal');
    const isPercent = value.includes('%') && !(doc.viewFlag & SvgViewFlag.Viewbox);
    doc.viewFlag |= isPercent ? SvgViewFlag.WidthInPercent : SvgViewFlag.Width;
  } else if (key === 'height') {
    doc.h = toLength(global, value, 'Vertical');
    const isPercent = value.includes('%') && !(doc.viewFlag & SvgViewFlag.Viewbox);
    doc.viewFlag |= isPercent ? SvgViewFlag.HeightInPercent : SvgViewFlag.Height;
  } else if (key === 'viewBox') {
    readViewBox(global, doc, value);
  } else if (key === 'preserveAspectRatio') {
    parseAspectRatio(value, doc);
  } else if (key === 'style') {
    return readStyle(context, node, value);
  } else {
    return parseStyleAttr(context, node, key, value, false);
  }
  return true;
}

/** A view box sets the view one number at a time, as far as its numbers read. */
function readViewBox(global: ViewGlobal, doc: SvgNode['node']['doc'], value: string): void {
  const x = parseNumber(value, 0);
  if (x) {
    doc.vx = x.value;
    const y = parseNumber(value, x.next);
    if (y) {
      doc.vy = y.value;
      const w = parseNumber(value, y.next);
      if (w) {
        doc.vw = w.value;
        const h = parseNumber(value, w.next);
        if (h) {
          doc.vh = h.value;
          doc.viewFlag |= SvgViewFlag.Viewbox;
          global.h = doc.vh;
        }
        global.w = doc.vw;
      }
      global.y = doc.vy;
    }
    global.x = doc.vx;
  }
  // A negative view box width or height invalidates the attribute.
  if (doc.viewFlag & SvgViewFlag.Viewbox && (doc.vw < 0 || doc.vh < 0)) doc.viewFlag &= ~SvgViewFlag.Viewbox;
  if (!(doc.viewFlag & SvgViewFlag.Viewbox)) {
    global.x = global.y = 0;
    global.w = global.h = 1;
  }
}

const createSvg: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Doc');
  const doc = node.node.doc;
  context.global.w = 1;
  context.global.h = 1;
  doc.align = 'XMidYMid';
  doc.meetOrSlice = 'Meet';
  doc.viewFlag = SvgViewFlag.None;
  parse(attributes, (key, value) => readSvgAttribute(context, node, key, value));
  if (!(doc.viewFlag & SvgViewFlag.Viewbox)) {
    if (doc.viewFlag & SvgViewFlag.Width) context.global.w = doc.w;
    if (doc.viewFlag & SvgViewFlag.Height) context.global.h = doc.h;
  }
  return node;
};

const createMask: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Mask');
  node.node.mask = { type: 'Luminance', userSpace: true };
  parse(attributes, (key, value) => {
    if (key === 'maskContentUnits') {
      if (value === 'objectBoundingBox') node.node.mask.userSpace = false;
      return true;
    }
    if (key === 'mask-type') {
      node.node.mask.type = toMaskType(value);
      return true;
    }
    if (key === 'clip-path' || key === 'mask') return parseStyleAttr(context, node, key, value, false);
    return readCommon(context, node, key, value, { transform: true });
  });
  return node;
};

const createClipPath: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'ClipPath');
  node.style.display = false;
  node.node.clip.userSpace = true;
  parse(attributes, (key, value) => {
    if (key === 'clipPathUnits') {
      if (value === 'objectBoundingBox') node.node.clip.userSpace = false;
      return true;
    }
    if (key === 'clip-path' || key === 'mask') return parseStyleAttr(context, node, key, value, false);
    return readCommon(context, node, key, value, { transform: true });
  });
  return node;
};

const createCssStyle: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'CssStyle');
  parse(attributes, (key, value) => {
    if (key !== 'id') return parseStyleAttr(context, node, key, value, false);
    node.id = copyId(value);
    return true;
  });
  return node;
};

const createSymbol: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Symbol');
  const symbol = node.node.symbol;
  Object.assign(symbol, {
    align: 'XMidYMid',
    meetOrSlice: 'Meet',
    overflowVisible: false,
    hasViewBox: false,
  });
  Object.assign(symbol, { hasWidth: false, hasHeight: false, vx: 0, vy: 0 });
  parse(attributes, (key, value) => {
    if (key === 'viewBox') return readSymbolViewBox(symbol, value);
    if (key === 'width') {
      symbol.w = toLength(context.global, value, 'Horizontal');
      symbol.hasWidth = true;
    } else if (key === 'height') {
      symbol.h = toLength(context.global, value, 'Vertical');
      symbol.hasHeight = true;
    } else if (key === 'preserveAspectRatio') {
      parseAspectRatio(value, symbol);
    } else if (key === 'overflow') {
      if (value === 'visible') symbol.overflowVisible = true;
    } else {
      return readGroupAttribute(context, node, key, value);
    }
    return true;
  });
  return node;
};

/** A symbol's view box, set only where all four numbers read, though each that reads is kept. */
function readSymbolViewBox(symbol: SvgNode['node']['symbol'], value: string): boolean {
  let at = 0;
  for (const field of ['vx', 'vy', 'vw', 'vh'] as const) {
    const parsed = parseNumber(value, at);
    if (!parsed) return false;
    symbol[field] = parsed.value;
    at = parsed.next;
  }
  symbol.hasViewBox = true;
  return true;
}

/** `_createDefsNode`: one `defs` node for the document, which every `defs` element and graphic's children share. */
export function createDefs(loader: { def: SvgNode | null; doc: SvgNode | null }): SvgNode {
  if (loader.def && loader.doc?.node.doc.defs) return loader.def;
  const node = createNode(null, 'Defs');
  loader.def = node;
  // ThorVG writes through the document it assumes, and a graphic before `<svg>` has none.
  if (loader.doc) loader.doc.node.doc.defs = node;
  return node;
}

const createPath: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Path');
  parse(attributes, (key, value) => {
    if (key !== 'd') return readCommon(context, node, key, value);
    node.node.path = copyId(value);
    return true;
  });
  return node;
};

const CIRCLE_LENGTHS = { cx: ['cx', 'Horizontal'], cy: ['cy', 'Vertical'], r: ['r', 'Diagonal'] } as const;
const ELLIPSE_LENGTHS = {
  cx: ['cx', 'Horizontal'],
  cy: ['cy', 'Vertical'],
  rx: ['rx', 'Horizontal'],
  ry: ['ry', 'Vertical'],
} as const;
const RECT_LENGTHS = {
  x: ['x', 'Horizontal'],
  y: ['y', 'Vertical'],
  width: ['w', 'Horizontal'],
  height: ['h', 'Vertical'],
  rx: ['rx', 'Horizontal'],
  ry: ['ry', 'Vertical'],
} as const;
const LINE_LENGTHS = {
  x1: ['x1', 'Horizontal'],
  y1: ['y1', 'Vertical'],
  x2: ['x2', 'Horizontal'],
  y2: ['y2', 'Vertical'],
} as const;
const BOX_LENGTHS = {
  x: ['x', 'Horizontal'],
  y: ['y', 'Vertical'],
  width: ['w', 'Horizontal'],
  height: ['h', 'Vertical'],
} as const;
const TEXT_LENGTHS = {
  x: ['x', 'Horizontal'],
  y: ['y', 'Vertical'],
  'font-size': ['fontSize', 'Vertical'],
} as const;

/** A shape element whose own attributes are lengths. */
function lengthShape(
  type: SvgNodeType,
  lengths: Readonly<Record<string, readonly [string, LengthType]>>,
  field: 'circle' | 'ellipse' | 'line'
): ElementFactory {
  return (context, parent, attributes, parse) => {
    const node = createNode(parent, type);
    parse(
      attributes,
      (key, value) =>
        readLength(context, node.node[field], lengths, key, value) || readCommon(context, node, key, value)
    );
    return node;
  };
}

const createRect: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Rect');
  const rect = node.node.rect;
  parse(attributes, (key, value) => {
    if (!readLength(context, rect, RECT_LENGTHS, key, value)) return readCommon(context, node, key, value);
    if (key === 'rx') rect.hasRx = true;
    if (key === 'ry') rect.hasRy = true;
    // A corner radius given alone sets the other.
    if (rect.rx >= FLOAT_EPSILON && rect.ry < FLOAT_EPSILON && rect.hasRx && !rect.hasRy) rect.ry = rect.rx;
    if (rect.ry >= FLOAT_EPSILON && rect.rx < FLOAT_EPSILON && !rect.hasRx && rect.hasRy) rect.rx = rect.ry;
    return true;
  });
  return node;
};

/** `_attrParsePolygonPoints`: pairs of numbers, as far as both of a pair read. */
function readPoints(points: number[], value: string): void {
  let at = 0;
  for (;;) {
    const x = parseNumber(value, at);
    if (!x) return;
    const y = parseNumber(value, x.next);
    if (!y) return;
    points.push(x.value, y.value);
    at = y.next;
  }
}

function polyShape(type: 'Polygon' | 'Polyline'): ElementFactory {
  return (context, parent, attributes, parse) => {
    const node = createNode(parent, type);
    parse(attributes, (key, value) => {
      if (key !== 'points') return readCommon(context, node, key, value);
      readPoints(node.node.points, value);
      return true;
    });
    return node;
  };
}

const createImage: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Image');
  const image = node.node.image;
  parse(attributes, (key, value) => {
    if (readLength(context, image, BOX_LENGTHS, key, value)) return true;
    if (key === 'href' || key === 'xlink:href') {
      image.href = idFromHref(value);
      return true;
    }
    if (
      key === 'style' ||
      key === 'id' ||
      key === 'class' ||
      key === 'clip-path' ||
      key === 'mask' ||
      key === 'transform'
    )
      return readCommon(context, node, key, value, { transform: true });
    // ThorVG reads an image's other attributes as style declarations, not presentation attributes.
    return parseStyleAttr(context, node, key, value, true);
  });
  return node;
};

const USE_LENGTHS = BOX_LENGTHS;

const createUse: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Use');
  const use = node.node.use;
  parse(attributes, (key, value) => {
    if (readLength(context, use, USE_LENGTHS, key, value)) {
      if (key === 'width') use.isWidthSet = true;
      else if (key === 'height') use.isHeightSet = true;
      return true;
    }
    if (key === 'href' || key === 'xlink:href') {
      context.readUseHref(node, value);
      return true;
    }
    return readGroupAttribute(context, node, key, value);
  });
  return node;
};

const createText: ElementFactory = (context, parent, attributes, parse) => {
  const node = createNode(parent, 'Text');
  node.node.text = { text: null, fontFamily: null, x: 0, y: 0, fontSize: 10 };
  parse(attributes, (key, value) => {
    if (readLength(context, node.node.text, TEXT_LENGTHS, key, value)) return true;
    if (key !== 'font-family') return readCommon(context, node, key, value);
    node.node.text.fontFamily = value;
    return true;
  });
  return node;
};

/** `graphicsTags[]`. */
export const GRAPHICS_FACTORIES: ReadonlyMap<string, ElementFactory> = new Map([
  ['use', createUse],
  ['circle', lengthShape('Circle', CIRCLE_LENGTHS, 'circle')],
  ['ellipse', lengthShape('Ellipse', ELLIPSE_LENGTHS, 'ellipse')],
  ['path', createPath],
  ['polygon', polyShape('Polygon')],
  ['rect', createRect],
  ['polyline', polyShape('Polyline')],
  ['line', lengthShape('Line', LINE_LENGTHS, 'line')],
  ['image', createImage],
  ['text', createText],
]);

/** `groupTags[]`, without `defs`, which the loader creates itself. */
export const GROUP_FACTORIES: ReadonlyMap<string, ElementFactory> = new Map([
  ['g', createG],
  ['svg', createSvg],
  ['mask', createMask],
  ['clipPath', createClipPath],
  ['style', createCssStyle],
  ['symbol', createSymbol],
]);

export const GROUP_TAGS = ['defs', 'g', 'svg', 'mask', 'clipPath', 'style', 'symbol'] as const;

/** `_createFontFace`: a `@font-face` rule's family and source. */
export function readFontFace(context: ElementContext, declarations: string): void {
  const font: { name: string | null; src: string | null } = { name: null, src: null };
  context.fonts.push(font);
  simpleXmlParseW3CAttribute(declarations, (rawKey, rawValue) => {
    const key = rawKey.trimStart();
    const value = rawValue.trimStart();
    if (key === 'font-family')
      font.name =
        value.length >= 2 && value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value;
    else if (key === 'src') font.src = srcFromUrl(value);
    return true;
  });
}
