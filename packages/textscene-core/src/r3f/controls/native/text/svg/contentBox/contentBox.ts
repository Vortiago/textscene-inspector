/**
 * The content box ThorVG sizes a glyph's document by when Godot drops its view box
 * (`tvgSvgSceneBuilder.cpp:885-903`): the box of every drawn shape's path points, control points
 * included, each box moved corner by corner through its element's transform (`Paint::Impl::bounds`).
 * The browser's `getBBox` follows the curves instead, so a glyph with a curve at its edge would
 * size and place differently.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, identityMatrix, matrix, multiply, transformPoint, type Matrix, type Point } from './math';
import { emptyPath } from './renderPath';
import { strToFloat } from './strToFloat';
import { skipComma } from './svgNumbers';
import { svgPathToShape } from './svgPath';
import { parseTransform } from './svgTransform';

export interface ContentBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Bounds {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** ThorVG's `MAX_DEPTH` of nested groups it builds (`tvgSvgSceneBuilder.cpp`). */
const MAX_DEPTH = 2048;
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/** The box of the shapes `root` draws, or null for a document that draws no shape. */
export function thorvgContentBox(root: Element): ContentBox | null {
  const bounds = childrenBounds(root, 0);
  return (
    bounds && {
      x: bounds.x1,
      y: bounds.y1,
      width: f32(bounds.x2 - bounds.x1),
      height: f32(bounds.y2 - bounds.y1),
    }
  );
}

/** The union of the boxes of `parent`'s drawn children, each through its own transform. */
function childrenBounds(parent: Element, depth: number): Bounds | null {
  let union: Bounds | null = null;
  for (const child of Array.from(parent.children)) union = unionOf(union, elementBounds(child, depth));
  return union;
}

/** The box of one element in its parent's space, or null where it draws nothing ThorVG bounds. */
function elementBounds(element: Element, depth: number): Bounds | null {
  if (depth > MAX_DEPTH) return null;
  const own = ownBounds(element, depth);
  return own && transformedBounds(own, elementTransform(element));
}

function ownBounds(element: Element, depth: number): Bounds | null {
  switch (element.localName) {
    case 'g':
    case 'svg':
      return isHidden(element) ? null : childrenBounds(element, depth + 1);
    case 'use':
      return isHidden(element) ? null : boundsOfUse(element, depth);
    default:
      return pointsBounds(shapePoints(element));
  }
}

/** A `use` draws its target, at the use's `x` and `y` inside its transform (`_useBuildHelper`). */
function boundsOfUse(use: Element, depth: number): Bounds | null {
  const href = use.getAttribute('href') ?? use.getAttributeNS(XLINK_NAMESPACE, 'href') ?? '';
  const target = href.startsWith('#') ? use.ownerDocument.getElementById(href.slice(1)) : null;
  if (!target || target.contains(use)) return null;
  return target.localName === 'symbol' ? childrenBounds(target, depth + 1) : elementBounds(target, depth + 1);
}

/** The transform ThorVG gives an element's paint: its `transform`, and a `use`'s move to `x` and `y` after it. */
function elementTransform(element: Element): Matrix | null {
  const listed = parseTransform(element.getAttribute('transform') ?? '');
  if (element.localName !== 'use') return listed;
  const x = numberAttribute(element, 'x');
  const y = numberAttribute(element, 'y');
  if (x === 0 && y === 0) return listed;
  return multiply(listed ?? identityMatrix(), matrix(1, 0, x, 0, 1, y, 0, 0, 1));
}

/** A group ThorVG builds as an empty scene: one that does not display, or has no opacity. */
function isHidden(element: Element): boolean {
  return styleValue(element, 'display') === 'none' || styleValue(element, 'opacity') === '0';
}

function styleValue(element: Element, name: string): string | null {
  const declared = (element.getAttribute('style') ?? '')
    .split(';')
    .map((declaration) => declaration.split(':').map((part) => part.trim()))
    .find(([property]) => property === name);
  return declared?.[1] ?? element.getAttribute(name);
}

/** The path points ThorVG appends for a basic shape (`_recognizeShape`), none for any other element. */
function shapePoints(element: Element): Point[] {
  const at = (name: string) => numberAttribute(element, name);
  switch (element.localName) {
    case 'path': {
      const path = emptyPath();
      svgPathToShape(element.getAttribute('d') ?? '', path);
      return path.pts;
    }
    case 'rect':
      return corners(at('x'), at('y'), at('width'), at('height'));
    case 'circle':
      return corners(f32(at('cx') - at('r')), f32(at('cy') - at('r')), f32(at('r') * 2), f32(at('r') * 2));
    case 'ellipse':
      return corners(
        f32(at('cx') - at('rx')),
        f32(at('cy') - at('ry')),
        f32(at('rx') * 2),
        f32(at('ry') * 2)
      );
    case 'line':
      return [
        { x: at('x1'), y: at('y1') },
        { x: at('x2'), y: at('y2') },
      ];
    case 'polygon':
    case 'polyline':
      return listedPoints(element.getAttribute('points') ?? '');
    default:
      return [];
  }
}

/** The corners of a box, which bound every point ThorVG appends for a rect, a circle or an ellipse. */
function corners(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: f32(x + width), y: f32(y + height) },
  ];
}

/** `_attrParsePolygonPoints`: the pairs of a `points` list, an odd number left out. */
function listedPoints(text: string): Point[] {
  const numbers: number[] = [];
  for (let at = 0; at < text.length;) {
    const { value, end } = strToFloat(text, at);
    if (end === at) break;
    numbers.push(value);
    at = skipComma(text, end);
  }
  const points: Point[] = [];
  for (let at = 0; at + 1 < numbers.length; at += 2) points.push({ x: numbers[at]!, y: numbers[at + 1]! });
  return points;
}

/** A length attribute as a plain number, 0 where it is missing, as ThorVG reads a glyph's own units. */
function numberAttribute(element: Element, name: string): number {
  return strToFloat(element.getAttribute(name) ?? '').value;
}

function pointsBounds(points: readonly Point[]): Bounds | null {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/** The box of `bounds`' four corners through `m`. */
function transformedBounds(bounds: Bounds, m: Matrix | null): Bounds {
  if (!m) return bounds;
  return pointsBounds(
    [
      { x: bounds.x1, y: bounds.y1 },
      { x: bounds.x2, y: bounds.y1 },
      { x: bounds.x2, y: bounds.y2 },
      { x: bounds.x1, y: bounds.y2 },
    ].map((corner) => transformPoint(corner, m))
  )!;
}

function unionOf(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a || !b) return a ?? b;
  return {
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  };
}
