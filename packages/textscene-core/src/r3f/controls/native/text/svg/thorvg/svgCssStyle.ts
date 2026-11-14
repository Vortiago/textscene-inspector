/**
 * ThorVG's internal style sheet (`tvgSvgCssStyle.cpp`): finding a rule for a node's type and class,
 * and copying a rule's style onto a node where the node did not set it, or where the rule is
 * `!important` and the node's own value is not.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import {
  SvgFillFlags,
  SvgStrokeFlags,
  SvgStyleFlags,
  type SvgNode,
  type SvgNodeType,
  type SvgStyleProperty,
} from './svgNode';

/** Whether `from` sets the property: set and not yet set in `to`, or important where `to` is not. */
function applies(to: SvgStyleProperty, from: SvgStyleProperty, isSet: boolean, toFlag: number): boolean {
  const isImportant = !(to.flagsImportance & toFlag) && (from.flagsImportance & toFlag) !== 0;
  return (isSet && !(to.flags & toFlag)) || isImportant;
}

/** Marks the property set in `to`, and important where it is important in `from`. */
function mark(to: SvgStyleProperty, from: SvgStyleProperty, flag: number): void {
  to.flags |= flag;
  if (from.flagsImportance & flag) to.flagsImportance |= flag;
}

/** `_copyStyle`. */
function copyStyle(to: SvgStyleProperty, from: SvgStyleProperty): void {
  if (applies(to, from, from.curColorSet, SvgStyleFlags.Color)) {
    to.color = { ...from.color };
    to.curColorSet = true;
    mark(to, from, SvgStyleFlags.Color);
  }
  if (applies(to, from, (from.flags & SvgStyleFlags.PaintOrder) !== 0, SvgStyleFlags.PaintOrder)) {
    to.paintOrder = from.paintOrder;
    mark(to, from, SvgStyleFlags.PaintOrder);
  }
  if (applies(to, from, (from.flags & SvgStyleFlags.Display) !== 0, SvgStyleFlags.Display)) {
    to.display = from.display;
    mark(to, from, SvgStyleFlags.Display);
  }
  copyFill(to, from);
  copyStroke(to, from);
  if (applies(to, from, from.opacity < 255, SvgStyleFlags.Opacity)) {
    to.opacity = from.opacity;
    mark(to, from, SvgStyleFlags.Opacity);
  }
}

function copyFill(to: SvgStyleProperty, from: SvgStyleProperty): void {
  if (applies(to, from, (from.fill.flags & SvgFillFlags.Paint) !== 0, SvgStyleFlags.Fill)) {
    const { color, none, curColor, url } = from.fill.paint;
    Object.assign(to.fill.paint, { color: { ...color }, none, curColor });
    if (url) to.fill.paint.url = url;
    to.fill.flags |= SvgFillFlags.Paint;
    mark(to, from, SvgStyleFlags.Fill);
  }
  if (applies(to, from, (from.fill.flags & SvgFillFlags.Opacity) !== 0, SvgStyleFlags.FillOpacity)) {
    to.fill.opacity = from.fill.opacity;
    to.fill.flags |= SvgFillFlags.Opacity;
    mark(to, from, SvgStyleFlags.FillOpacity);
  }
  if (applies(to, from, (from.fill.flags & SvgFillFlags.FillRule) !== 0, SvgStyleFlags.FillRule)) {
    to.fill.fillRule = from.fill.fillRule;
    to.fill.flags |= SvgFillFlags.FillRule;
    mark(to, from, SvgStyleFlags.FillRule);
  }
}

function copyStroke(to: SvgStyleProperty, from: SvgStyleProperty): void {
  const isSet = (flag: number): boolean => (from.stroke.flags & flag) !== 0;
  if (applies(to, from, isSet(SvgStrokeFlags.Paint), SvgStyleFlags.Stroke)) {
    const { color, none, curColor, url } = from.stroke.paint;
    Object.assign(to.stroke.paint, { color: { ...color }, none, curColor });
    if (url) to.stroke.paint.url = url;
    to.stroke.flags |= SvgStrokeFlags.Paint;
    mark(to, from, SvgStyleFlags.Stroke);
  }
  if (applies(to, from, isSet(SvgStrokeFlags.Opacity), SvgStyleFlags.StrokeOpacity)) {
    to.stroke.opacity = from.stroke.opacity;
    to.stroke.flags |= SvgStrokeFlags.Opacity;
    mark(to, from, SvgStyleFlags.StrokeOpacity);
  }
  if (applies(to, from, isSet(SvgStrokeFlags.Width), SvgStyleFlags.StrokeWidth)) {
    to.stroke.width = from.stroke.width;
    to.stroke.flags |= SvgStrokeFlags.Width;
    mark(to, from, SvgStyleFlags.StrokeWidth);
  }
  // A rule with an empty dash array copies nothing, and leaves the flag unset.
  if (
    applies(to, from, isSet(SvgStrokeFlags.Dash), SvgStyleFlags.StrokeDashArray) &&
    from.stroke.dash.array.length > 0
  ) {
    to.stroke.dash.array = [...from.stroke.dash.array];
    to.stroke.flags |= SvgStrokeFlags.Dash;
    mark(to, from, SvgStyleFlags.StrokeDashArray);
  }
  if (applies(to, from, isSet(SvgStrokeFlags.Cap), SvgStyleFlags.StrokeLineCap)) {
    to.stroke.cap = from.stroke.cap;
    to.stroke.flags |= SvgStrokeFlags.Cap;
    mark(to, from, SvgStyleFlags.StrokeLineCap);
  }
  if (applies(to, from, isSet(SvgStrokeFlags.Join), SvgStyleFlags.StrokeLineJoin)) {
    to.stroke.join = from.stroke.join;
    to.stroke.flags |= SvgStrokeFlags.Join;
    mark(to, from, SvgStyleFlags.StrokeLineJoin);
  }
}

/** `cssCopyStyleAttr`: a rule's transform, style and composite references onto a node. */
export function cssCopyStyleAttr(to: SvgNode, from: SvgNode): void {
  if (from.transform && !(to.style.flags & SvgStyleFlags.Transform)) {
    to.transform = { ...from.transform };
    to.style.flags |= SvgStyleFlags.Transform;
  }
  copyStyle(to.style, from.style);
  if (from.style.clipPath.url) to.style.clipPath.url = from.style.clipPath.url;
  if (from.style.mask.url) to.style.mask.url = from.style.mask.url;
}

/** The rule for `type` named `title`, or the unnamed rule for `type` where `title` is null. */
export function cssFindStyleNodeOfType(
  style: SvgNode | null,
  title: string | null,
  type: SvgNodeType
): SvgNode | null {
  if (!style) return null;
  for (const child of style.child) {
    if (child.type !== type) continue;
    if ((!title && !child.id) || (title && child.id === title)) return child;
  }
  return null;
}

/** The class rule named `title`. */
export function cssFindStyleNode(style: SvgNode | null, title: string | null): SvgNode | null {
  if (!style || !title) return null;
  return style.child.find((child) => child.type === 'CssStyle' && child.id === title) ?? null;
}

/** `cssUpdateStyle`: each node below `doc` takes the unnamed rule for its type. */
export function cssUpdateStyle(doc: SvgNode, style: SvgNode): void {
  for (const child of doc.child) {
    const cssNode = cssFindStyleNodeOfType(style, null, child.type);
    if (cssNode) cssCopyStyleAttr(child, cssNode);
    cssUpdateStyle(child, style);
  }
}

/** `cssApplyStyleToPostponeds`: the class rules for nodes whose class came before the style sheet. */
export function cssApplyStyleToPostponeds(
  postponeds: readonly { node: SvgNode; id: string | null }[],
  style: SvgNode | null
): void {
  for (const { node, id } of postponeds) {
    const typed = cssFindStyleNodeOfType(style, id, node.type);
    if (typed) cssCopyStyleAttr(node, typed);
    const classed = cssFindStyleNode(style, id);
    if (classed) cssCopyStyleAttr(node, classed);
  }
}
