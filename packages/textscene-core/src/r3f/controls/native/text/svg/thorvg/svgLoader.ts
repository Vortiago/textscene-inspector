/**
 * ThorVG's SVG loader (`tvgSvgLoader.cpp:3290-4035`): the pass over a document's tags that builds
 * the node tree, then the passes that resolve style sheets, `use` references, clip paths, masks,
 * inherited styles and gradients. It reads the document as `SvgLoader::header` does when the `svg`
 * element has no view box, which is how Godot hands it a glyph.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { cssApplyStyleToPostponeds, cssUpdateStyle } from './svgCssStyle';
import {
  createDefs,
  GRAPHICS_FACTORIES,
  GROUP_FACTORIES,
  GROUP_TAGS,
  readFontFace,
  type ElementContext,
} from './svgElements';
import { cloneGradient, gradientFactory, inheritGradient } from './svgGradients';
import {
  createNode,
  SvgFillFlags,
  SvgStrokeFlags,
  SvgStyleFlags,
  type ColorStop,
  type SvgColor,
  type SvgNode,
  type SvgStyleGradient,
  type SvgStyleProperty,
} from './svgNode';
import { copyId } from './svgStyleAttributes';
import { idFromHref, toColour, toOffset, toOpacity, type ViewGlobal } from './svgValues';
import {
  isSpace,
  simpleXmlFindAttributesTag,
  simpleXmlParse,
  simpleXmlParseAttributes,
  simpleXmlParseCssAttribute,
  simpleXmlParseW3CAttribute,
  SimpleXmlType,
} from './xmlParser';

/** The parsed document: its root, its shared `defs`, and the gradients declared outside it. */
export interface SvgDocument {
  readonly doc: SvgNode;
  readonly defs: SvgNode | null;
  readonly gradients: readonly SvgStyleGradient[];
  readonly global: ViewGlobal;
}

/** Tag names this long or longer are not read (`char tagName[20]`). */
const TAG_NAME_CAPACITY = 20;

/** How deep `_checkPostponed` looks for a pending `use` target before it gives up. */
const POSTPONED_DEPTH_LIMIT = 512;

/** How deep `_cloneNode` copies before it stops on a reference loop. */
const CLONE_DEPTH_LIMIT = 8192;

type OpenedTag = 'Other' | 'Style' | 'Text';

/** `SvgLoaderData`, with the stop being read (`SvgParser::gradStop`). */
export interface LoaderState {
  stack: SvgNode[];
  doc: SvgNode | null;
  def: SvgNode | null;
  cssStyle: SvgNode | null;
  gradients: SvgStyleGradient[];
  gradientStack: SvgStyleGradient[];
  /** `use` nodes whose target was not found yet, or whose target holds one that waits. */
  cloneNodes: { node: SvgNode; id: string }[];
  nodesToStyle: { node: SvgNode; id: string | null }[];
  fonts: { name: string | null; src: string | null }[];
  openedTag: OpenedTag;
  /** The node the last factory made, which text data is appended to (`svgParse->node`). */
  current: SvgNode | null;
  global: ViewGlobal;
  stop: { stop: ColorStop; hasOpacity: boolean; hasColour: boolean };
}

function newState(): LoaderState {
  return {
    stack: [],
    doc: null,
    def: null,
    cssStyle: null,
    gradients: [],
    gradientStack: [],
    cloneNodes: [],
    nodesToStyle: [],
    fonts: [],
    openedTag: 'Other',
    current: null,
    global: { x: 0, y: 0, w: 0, h: 0 },
    stop: { stop: { offset: 0, r: 0, g: 0, b: 0, a: 255 }, hasOpacity: false, hasColour: false },
  };
}

function elementContext(state: LoaderState): ElementContext {
  return {
    global: state.global,
    get cssStyle() {
      return state.cssStyle;
    },
    nodesToStyle: state.nodesToStyle,
    fonts: state.fonts,
    readUseHref: (node, value) => readUseHref(state, node, value),
  };
}

/** A document whose `svg` element is read (`SvgLoader::header`), and the state the full read goes on from. */
export interface SvgHeader {
  readonly text: string;
  readonly doc: SvgNode;
  readonly state: LoaderState;
}

/** `SvgLoader::header`: the `svg` element alone, or null where the text holds none. */
export function readSvgHeader(text: string): SvgHeader | null {
  const state = newState();
  const context = elementContext(state);
  simpleXmlParse(text, true, (type, content) => {
    if (type !== SimpleXmlType.Open && type !== SimpleXmlType.OpenEmpty) return true;
    return !readHeaderTag(state, context, content);
  });
  return state.doc ? { text, doc: state.doc, state } : null;
}

/** `SvgLoader::run`, up to the scene build: the whole tree, or null where the text does not parse. */
export function readSvgBody({ text, doc, state }: SvgHeader): SvgDocument | null {
  const context = elementContext(state);
  const isParsed = simpleXmlParse(text, true, (type, content) => {
    readNode(state, context, type, content);
    return true;
  });
  if (!isParsed) return null;
  resolve(state, doc);
  return { doc, defs: doc.node.doc.defs, gradients: state.gradients, global: state.global };
}

/** The passes after the tags are read (`SvgLoader::run`). */
function resolve(state: LoaderState, doc: SvgNode): void {
  const defs = doc.node.doc.defs;
  if (state.nodesToStyle.length > 0) cssApplyStyleToPostponeds(state.nodesToStyle, state.cssStyle);
  if (state.cssStyle) cssUpdateStyle(doc, state.cssStyle);
  if (state.cloneNodes.length > 0) clonePostponedNodes(state, doc);
  updateComposite(doc, doc);
  if (defs) updateComposite(doc, defs);
  updateStyle(doc, null);
  if (defs) updateStyle(defs, null);
  if (state.gradients.length > 0) updateGradient(state.global, doc, state.gradients);
  if (defs) updateGradient(state.global, doc, defs.node.defsGradients);
}

/** The tag name and the attribute text of an opening tag, or null for a name too long to read. */
function splitTag(content: string, isEmpty: boolean): { tagName: string; attributes: string } | null {
  const found = simpleXmlFindAttributesTag(content);
  // A tag with no attributes ends at its `>`, or at its `/` where it closes itself.
  let size = found >= 0 ? found : content.length;
  if (found < 0 && isEmpty) size = content.length;
  while (size > 0 && isSpace(content[size - 1])) size--;
  if (size >= TAG_NAME_CAPACITY) return null;
  return { tagName: content.slice(0, size), attributes: found >= 0 ? content.slice(found) : '' };
}

/** `_svgLoaderParserForValidCheckXmlOpen`: true once the `svg` element is read. */
function readHeaderTag(state: LoaderState, context: ElementContext, content: string): boolean {
  const tag = splitTag(content, false);
  if (!tag) return true;
  if (!GROUP_TAGS.includes(tag.tagName as (typeof GROUP_TAGS)[number]) || state.doc) return false;
  if (tag.tagName !== 'svg') return false;
  const doc = GROUP_FACTORIES.get('svg')!(context, null, tag.attributes, simpleXmlParseAttributes);
  state.doc = doc;
  state.current = doc;
  state.stack.push(doc);
  return true;
}

/** `_svgLoaderParser`. */
function readNode(state: LoaderState, context: ElementContext, type: number, content: string): void {
  switch (type) {
    case SimpleXmlType.Open:
      openTag(state, context, content, false);
      break;
    case SimpleXmlType.OpenEmpty:
      openTag(state, context, content, true);
      break;
    case SimpleXmlType.Close:
      closeTag(state, content);
      break;
    case SimpleXmlType.Data:
    case SimpleXmlType.CData:
      if (state.openedTag === 'Style') readStyleSheet(state, context, content);
      else if (state.openedTag === 'Text') appendText(state, content);
      break;
  }
}

function parentOf(state: LoaderState): SvgNode | null {
  return state.stack.at(-1) ?? state.doc;
}

/** `_svgLoaderParserXmlOpen`. */
function openTag(state: LoaderState, context: ElementContext, content: string, isEmpty: boolean): void {
  const tag = splitTag(content, isEmpty);
  if (!tag) return;
  const { tagName, attributes } = tag;
  if (GROUP_TAGS.includes(tagName as (typeof GROUP_TAGS)[number])) {
    openGroup(state, context, tagName, attributes, isEmpty);
    return;
  }
  const graphic = GRAPHICS_FACTORIES.get(tagName);
  if (graphic) {
    const node = graphic(context, parentOf(state), attributes, simpleXmlParseAttributes);
    state.current = node;
    if (isEmpty) return;
    if (tagName === 'text') state.openedTag = 'Text';
    // A graphic's children are kept in the document's `defs`, where only a reference draws them.
    state.stack.push(createDefs(state));
    return;
  }
  const gradient = gradientFactory(tagName);
  if (gradient) {
    openGradient(state, gradient(state.global, attributes), isEmpty);
    return;
  }
  if (tagName === 'stop') readStop(state, attributes);
}

function openGroup(
  state: LoaderState,
  context: ElementContext,
  tagName: string,
  attributes: string,
  isEmpty: boolean
): void {
  if (isEmpty) return;
  let node: SvgNode | null = null;
  if (!state.doc) {
    if (tagName !== 'svg') return;
    node = GROUP_FACTORIES.get('svg')!(context, null, attributes, simpleXmlParseAttributes);
    state.doc = node;
  } else {
    // The `svg` element the header pass read is the document; another is not read.
    if (tagName === 'svg') return;
    if (tagName === 'defs') {
      node = createDefs(state);
    } else if (tagName === 'style') {
      // Only the first style sheet is kept.
      if (!state.cssStyle) {
        node = GROUP_FACTORIES.get('style')!(context, null, attributes, simpleXmlParseAttributes);
        state.cssStyle = node;
        state.doc.node.doc.style = node;
        state.openedTag = 'Style';
      }
    } else {
      node = GROUP_FACTORIES.get(tagName)!(context, parentOf(state), attributes, simpleXmlParseAttributes);
    }
  }
  if (!node) return;
  state.current = node;
  state.stack.push(node);
}

/** A gradient joins the list only where it is not nested in another, and the earliest declared wins. */
function openGradient(state: LoaderState, gradient: SvgStyleGradient, isEmpty: boolean): void {
  if (state.gradientStack.length === 0) {
    if (state.def && state.doc?.node.doc.defs) state.def.node.defsGradients.push(gradient);
    else state.gradients.push(gradient);
  }
  if (!isEmpty) state.gradientStack.push(gradient);
}

/** `_findLatestColor`: the colour of the nearest open element that sets one. */
function latestColour(state: LoaderState): SvgColor | null {
  for (let parent = parentOf(state); parent; parent = parent.parent) {
    if (parent.style.curColorSet) return parent.style.color;
  }
  return null;
}

/** A stop's colour: `currentColor`, or a colour where `isAccepted`. */
function readStopColour(state: LoaderState, value: string, isAccepted: boolean): boolean {
  const { stop } = state.stop;
  if (value === 'currentColor') {
    const colour = latestColour(state);
    if (colour) Object.assign(stop, colour);
    return false;
  }
  if (!isAccepted) return false;
  const parsed = toColour(value, false);
  if (parsed.kind !== 'colour') return false;
  if (parsed.colour) Object.assign(stop, parsed.colour);
  return true;
}

/** `_attrParseStops`: a `style` declaration wins over the attribute of the same name. */
function readStop(state: LoaderState, attributes: string): void {
  const gradient = state.gradientStack.at(-1);
  if (!gradient) return;
  state.stop = { stop: { offset: 0, r: 0, g: 0, b: 0, a: 255 }, hasOpacity: false, hasColour: false };
  const reading = state.stop;
  simpleXmlParseAttributes(attributes, (key, value) => {
    if (key === 'offset') {
      reading.stop.offset = toOffset(value);
    } else if (key === 'stop-opacity') {
      if (!reading.hasOpacity) reading.stop.a = toOpacity(value);
    } else if (key === 'stop-color') {
      readStopColour(state, value, !reading.hasColour);
    } else if (key === 'style') {
      simpleXmlParseW3CAttribute(value, (styleKey, styleValue) => readStopStyle(state, styleKey, styleValue));
    } else {
      return false;
    }
    return true;
  });
  gradient.stops.push({ ...reading.stop });
}

function readStopStyle(state: LoaderState, key: string, value: string): boolean {
  if (key === 'stop-opacity') {
    state.stop.stop.a = toOpacity(value);
    state.stop.hasOpacity = true;
  } else if (key === 'stop-color') {
    if (readStopColour(state, value, true)) state.stop.hasColour = true;
  } else {
    return false;
  }
  return true;
}

/**
 * `_svgLoaderParserXmlClose`. ThorVG compares the closing name as a prefix of each tag it knows, so
 * a closing tag can pop a stack it did not push.
 */
function closeTag(state: LoaderState, content: string): void {
  const end = content.indexOf('>');
  let size = end >= 0 ? end : content.length;
  const start = content.length - content.trimStart().length;
  let tagName = content.slice(start, start + size);
  size = tagName.length;
  while (size > 0 && isSpace(tagName[size - 1])) size--;
  tagName = tagName.slice(0, Math.min(size, TAG_NAME_CAPACITY - 1));
  const isPrefixOf = (tag: string): boolean => tag.startsWith(tagName);
  if (GROUP_TAGS.some(isPrefixOf)) state.stack.pop();
  if (['linearGradient', 'radialGradient'].some(isPrefixOf)) state.gradientStack.pop();
  if ([...GRAPHICS_FACTORIES.keys()].some(isPrefixOf)) {
    if (tagName.startsWith('text')) state.openedTag = 'Other';
    state.stack.pop();
  }
}

/** `_svgLoaderParserText`: a text element's characters. */
function appendText(state: LoaderState, content: string): void {
  const node = state.current;
  if (node?.type !== 'Text') return;
  node.node.text.text = (node.node.text.text ?? '') + content;
}

/** `_svgLoaderParserXmlCssStyle`: each rule of the style sheet as a node under it. */
function readStyleSheet(state: LoaderState, context: ElementContext, content: string): void {
  let rest = content;
  for (;;) {
    const rule = simpleXmlParseCssAttribute(rest);
    if (!rule) break;
    const { tag, name, declarations } = rule;
    const factory = tag === 'defs' ? null : (GROUP_FACTORIES.get(tag) ?? GRAPHICS_FACTORIES.get(tag));
    if (factory || tag === 'all') {
      const create = factory ?? GROUP_FACTORIES.get('style')!;
      const node = create(context, state.cssStyle, declarations, simpleXmlParseW3CAttribute);
      node.id = copyId(name);
    } else if (tag === '@font-face') {
      readFontFace(context, declarations);
    }
    rest = rest.slice(rule.next);
  }
  state.openedTag = 'Other';
}

/** `_getDefsNode`: the `defs` of the tree that holds `node`. */
function defsOf(node: SvgNode | null): SvgNode | null {
  if (!node) return null;
  while (node.parent) node = node.parent;
  if (node.type === 'Doc') return node.node.doc.defs;
  return node.type === 'Defs' ? node : null;
}

function findNodeById(node: SvgNode | null, id: string): SvgNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.child) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/** `_findParentById`: an ancestor of `node` below `doc` with `id`, which a `use` must not reference. */
function hasAncestorWithId(node: SvgNode, id: string, doc: SvgNode | null): boolean {
  for (let parent = node.parent; parent && parent !== doc; parent = parent.parent)
    if (parent.id === id) return true;
  return false;
}

/** `_checkPostponed`: whether `cloneNode` is `node` or below it. */
function holdsNode(node: SvgNode, cloneNode: SvgNode, depth: number): boolean {
  if (node === cloneNode) return true;
  if (depth === POSTPONED_DEPTH_LIMIT) return false;
  return node.child.some((child) => holdsNode(child, cloneNode, depth + 1));
}

/** `_attrParseUseNode`'s `href`: the target cloned now, or later where it is not read yet or holds a pending `use`. */
function readUseHref(state: LoaderState, node: SvgNode, value: string): void {
  const id = idFromHref(value);
  const from = findNodeById(defsOf(node), id);
  if (!from) {
    state.cloneNodes.push({ node, id });
    return;
  }
  if (hasAncestorWithId(node, id, state.doc)) return;
  if (state.cloneNodes.some((pair) => holdsNode(from, pair.node, 1))) {
    state.cloneNodes.push({ node, id });
    return;
  }
  cloneNode(from, node, 0);
  if (from.type === 'Symbol') node.node.use.symbol = from;
}

/**
 * `_clonePostponedNodes`. A target that holds a pending `use` goes to the back of the list, and
 * ThorVG loops for ever on two that hold each other: a pass that clones nothing stops here instead.
 */
function clonePostponedNodes(state: LoaderState, doc: SvgNode): void {
  const pending = state.cloneNodes;
  let deferredInARow = 0;
  while (pending.length > 0 && deferredInARow <= pending.length) {
    const pair = pending.shift()!;
    if (hasAncestorWithId(pair.node, pair.id, doc)) {
      deferredInARow = 0;
      continue;
    }
    const from = findNodeById(defsOf(pair.node), pair.id) ?? findNodeById(doc, pair.id);
    if (from && pending.some((other) => holdsNode(from, other.node, 1))) {
      pending.push(pair);
      deferredInARow++;
      continue;
    }
    deferredInARow = 0;
    if (!from) continue;
    cloneNode(from, pair.node, 0);
    if (from.type === 'Symbol' && pair.node.type === 'Use') pair.node.node.use.symbol = from;
  }
}

/** `_cloneNode`: a copy of `from` and its children under `parent`, styled from `parent` where it sets nothing. */
function cloneNode(from: SvgNode, parent: SvgNode, depth: number): void {
  if (depth === CLONE_DEPTH_LIMIT || from === parent) return;
  const node = createNode(parent, from.type);
  styleInherit(node.style, parent.style);
  copyAttr(node, from);
  for (const child of from.child) cloneNode(child, node, depth + 1);
}

/** `_copyAttr`: the transform, the style set explicitly, and the shape data a clone keeps. */
function copyAttr(to: SvgNode, from: SvgNode): void {
  if (from.transform) to.transform = { ...from.transform };
  styleCopy(to.style, from.style);
  to.style.flags |= from.style.flags;
  if (from.style.clipPath.url) to.style.clipPath.url = from.style.clipPath.url;
  if (from.style.mask.url) to.style.mask.url = from.style.mask.url;
  const data = from.node;
  switch (from.type) {
    case 'Circle':
      to.node.circle = { ...data.circle };
      break;
    case 'Ellipse':
      to.node.ellipse = { ...data.ellipse };
      break;
    case 'Rect':
      to.node.rect = { ...data.rect };
      break;
    case 'Line':
      to.node.line = { ...data.line };
      break;
    case 'Path':
      if (data.path) to.node.path = data.path;
      break;
    case 'Polygon':
    case 'Polyline':
      to.node.points = [...data.points];
      break;
    case 'Image':
      to.node.image = { ...data.image, href: data.image.href ?? to.node.image.href };
      break;
    case 'Use':
      to.node.use = { ...data.use };
      break;
    case 'Text':
      to.node.text = {
        x: data.text.x,
        y: data.text.y,
        fontSize: data.text.fontSize,
        text: data.text.text ?? to.node.text.text,
        fontFamily: data.text.fontFamily ?? to.node.text.fontFamily,
      };
      break;
    default:
      break;
  }
}

function copyPaint(to: SvgStyleProperty['fill']['paint'], from: SvgStyleProperty['fill']['paint']): void {
  to.color = { ...from.color };
  to.none = from.none;
  to.curColor = from.curColor;
  if (from.url) to.url = from.url;
}

/** `_styleCopy`: the properties `from` set explicitly. */
function styleCopy(to: SvgStyleProperty, from: SvgStyleProperty): void {
  if (from.curColorSet) {
    to.color = { ...from.color };
    to.curColorSet = true;
  }
  if (from.flags & SvgStyleFlags.Opacity) to.opacity = from.opacity;
  if (from.flags & SvgStyleFlags.PaintOrder) to.paintOrder = from.paintOrder;
  if (from.flags & SvgStyleFlags.Display) to.display = from.display;
  to.fill.flags |= from.fill.flags;
  if (from.fill.flags & SvgFillFlags.Paint) copyPaint(to.fill.paint, from.fill.paint);
  if (from.fill.flags & SvgFillFlags.Opacity) to.fill.opacity = from.fill.opacity;
  if (from.fill.flags & SvgFillFlags.FillRule) to.fill.fillRule = from.fill.fillRule;
  to.stroke.flags |= from.stroke.flags;
  copyStrokeWhere(to, from, (flag) => (from.stroke.flags & flag) !== 0);
}

/** The stroke properties for which `isTaken` holds, from `from` to `to`. */
function copyStrokeWhere(
  to: SvgStyleProperty,
  from: SvgStyleProperty,
  isTaken: (flag: number) => boolean
): void {
  if (isTaken(SvgStrokeFlags.Paint)) copyPaint(to.stroke.paint, from.stroke.paint);
  if (isTaken(SvgStrokeFlags.Opacity)) to.stroke.opacity = from.stroke.opacity;
  if (isTaken(SvgStrokeFlags.Width)) to.stroke.width = from.stroke.width;
  if (isTaken(SvgStrokeFlags.Dash) && from.stroke.dash.array.length > 0)
    to.stroke.dash.array = [...from.stroke.dash.array];
  if (isTaken(SvgStrokeFlags.DashOffset)) to.stroke.dash.offset = from.stroke.dash.offset;
  if (isTaken(SvgStrokeFlags.Cap)) to.stroke.cap = from.stroke.cap;
  if (isTaken(SvgStrokeFlags.Join)) to.stroke.join = from.stroke.join;
  if (isTaken(SvgStrokeFlags.Miterlimit)) to.stroke.miterlimit = from.stroke.miterlimit;
}

/** `_styleInherit`: what `child` did not set, from `parent`. */
function styleInherit(child: SvgStyleProperty, parent: SvgStyleProperty | null): void {
  if (!parent) return;
  if (!child.curColorSet) {
    child.color = { ...parent.color };
    child.curColorSet = parent.curColorSet;
  }
  if (!(child.flags & SvgStyleFlags.PaintOrder)) child.paintOrder = parent.paintOrder;
  if (!(child.fill.flags & SvgFillFlags.Paint)) copyPaint(child.fill.paint, parent.fill.paint);
  if (!(child.fill.flags & SvgFillFlags.Opacity)) child.fill.opacity = parent.fill.opacity;
  if (!(child.fill.flags & SvgFillFlags.FillRule)) child.fill.fillRule = parent.fill.fillRule;
  copyStrokeWhere(child, parent, (flag) => !(child.stroke.flags & flag));
}

/** `_updateStyle`: each node inherits down the tree. */
function updateStyle(node: SvgNode, parentStyle: SvgStyleProperty | null): void {
  styleInherit(node.style, parentStyle);
  for (const child of node.child) updateStyle(child, node.style);
}

/** `_updateComposite`: clip path and mask references found under `root`. */
function updateComposite(node: SvgNode, root: SvgNode): void {
  const { clipPath, mask } = node.style;
  if (clipPath.url && !clipPath.node) clipPath.node = findNodeById(root, clipPath.url);
  if (mask.url && !mask.node) mask.node = findNodeById(root, mask.url);
  for (const child of node.child) updateComposite(child, root);
}

/** `_gradientDup`: a copy of the gradient `id` names, with what its own `href` names inherited. */
function gradientDup(
  global: ViewGlobal,
  gradients: readonly SvgStyleGradient[],
  id: string
): SvgStyleGradient | null {
  const found = gradients.find((gradient) => gradient.id === id);
  if (!found) return null;
  const result = cloneGradient(found);
  if (result.ref) {
    const parent = gradients.find((gradient) => gradient.id === result.ref);
    if (parent) inheritGradient(global, result, parent);
  }
  return result;
}

/** `_updateGradient`: each leaf's fill and stroke gradient, resolved from its URL. */
function updateGradient(global: ViewGlobal, node: SvgNode, gradients: readonly SvgStyleGradient[]): void {
  if (node.child.length > 0) {
    for (const child of node.child) updateGradient(global, child, gradients);
    return;
  }
  for (const paint of [node.style.fill.paint, node.style.stroke.paint]) {
    if (!paint.url) continue;
    const gradient = gradientDup(global, gradients, paint.url);
    if (gradient) paint.gradient = gradient;
  }
}
