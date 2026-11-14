/**
 * Gradients in ThorVG's SVG loader (`tvgSvgLoader.cpp:2299-3036`): the attributes of a linear or
 * radial gradient, its stops, and a gradient that inherits from the one its `href` names.
 * Coordinates in user space are kept as fractions of the view, which the scene builder scales back.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32 } from './math';
import {
  SvgGradientFlags,
  type SvgLinearGradient,
  type SvgRadialGradient,
  type SvgStyleGradient,
} from './svgNode';
import { copyId } from './svgStyleAttributes';
import {
  idFromHref,
  parseTransform,
  toGradientLength,
  toSpread,
  viewDiagonal,
  type ViewGlobal,
} from './svgValues';
import { simpleXmlParseAttributes } from './xmlParser';

type Axis = 'Horizontal' | 'Vertical' | 'Diagonal';

/** A gradient coordinate: its field, its percentage field, its flag, and the length a user space value is a share of. */
interface Coordinate<T> {
  readonly tag: string;
  readonly key: keyof T & string;
  readonly percentageKey: keyof T & string;
  readonly flag: number;
  readonly axis: Axis;
}

const LINEAR: readonly Coordinate<SvgLinearGradient>[] = [
  { tag: 'x1', key: 'x1', percentageKey: 'isX1Percentage', flag: SvgGradientFlags.X1, axis: 'Horizontal' },
  { tag: 'y1', key: 'y1', percentageKey: 'isY1Percentage', flag: SvgGradientFlags.Y1, axis: 'Vertical' },
  { tag: 'x2', key: 'x2', percentageKey: 'isX2Percentage', flag: SvgGradientFlags.X2, axis: 'Horizontal' },
  { tag: 'y2', key: 'y2', percentageKey: 'isY2Percentage', flag: SvgGradientFlags.Y2, axis: 'Vertical' },
];

const RADIAL: readonly Coordinate<SvgRadialGradient>[] = [
  { tag: 'cx', key: 'cx', percentageKey: 'isCxPercentage', flag: SvgGradientFlags.Cx, axis: 'Horizontal' },
  { tag: 'cy', key: 'cy', percentageKey: 'isCyPercentage', flag: SvgGradientFlags.Cy, axis: 'Vertical' },
  { tag: 'fx', key: 'fx', percentageKey: 'isFxPercentage', flag: SvgGradientFlags.Fx, axis: 'Horizontal' },
  { tag: 'fy', key: 'fy', percentageKey: 'isFyPercentage', flag: SvgGradientFlags.Fy, axis: 'Vertical' },
  { tag: 'r', key: 'r', percentageKey: 'isRPercentage', flag: SvgGradientFlags.R, axis: 'Diagonal' },
  { tag: 'fr', key: 'fr', percentageKey: 'isFrPercentage', flag: SvgGradientFlags.Fr, axis: 'Diagonal' },
];

function axisLength(global: ViewGlobal, axis: Axis): number {
  if (axis === 'Horizontal') return global.w;
  return axis === 'Vertical' ? global.h : viewDiagonal(global);
}

/** `_recalc...Attr`: a user space coordinate as a share of the view. */
function recalc<T>(global: ViewGlobal, values: T, coordinate: Coordinate<T>, isUserSpace: boolean): void {
  const record = values as Record<string, number | boolean>;
  if (isUserSpace && !record[coordinate.percentageKey])
    record[coordinate.key] = f32((record[coordinate.key] as number) / axisLength(global, coordinate.axis));
}

/** `_recalcInherited...Attr`: an inherited coordinate moved into the units of the gradient that inherits it. */
function recalcInherited<T>(
  global: ViewGlobal,
  values: T,
  coordinate: Coordinate<T>,
  isUserSpace: boolean
): void {
  const record = values as Record<string, number | boolean>;
  if (record[coordinate.percentageKey]) return;
  const length = axisLength(global, coordinate.axis);
  const value = record[coordinate.key] as number;
  record[coordinate.key] = f32(isUserSpace ? value / length : value * length);
}

/** `_inherit...Attr`. */
function inherit<T>(to: T, from: T, coordinate: Coordinate<T>): void {
  const target = to as Record<string, number | boolean>;
  const source = from as Record<string, number | boolean>;
  target[coordinate.key] = source[coordinate.key]!;
  target[coordinate.percentageKey] = source[coordinate.percentageKey]!;
}

function newGradient(type: 'Linear' | 'Radial'): SvgStyleGradient {
  return {
    type,
    id: null,
    ref: null,
    spread: 'Pad',
    radial: null,
    linear: null,
    transform: null,
    stops: [],
    flags: SvgGradientFlags.None,
    userSpace: false,
  };
}

/** The attributes every gradient reads, or false for one this gradient does not know. */
function readCommon(gradient: SvgStyleGradient, key: string, value: string): boolean {
  if (key === 'id') {
    gradient.id = copyId(value);
  } else if (key === 'spreadMethod') {
    gradient.spread = toSpread(value);
    gradient.flags |= SvgGradientFlags.SpreadMethod;
  } else if (key === 'href' || key === 'xlink:href') {
    gradient.ref = idFromHref(value);
  } else if (key === 'gradientUnits') {
    if (value === 'userSpaceOnUse') gradient.userSpace = true;
    gradient.flags |= SvgGradientFlags.GradientUnits;
  } else if (key === 'gradientTransform') {
    gradient.transform = parseTransform(value);
  } else {
    return false;
  }
  return true;
}

/** `_createLinearGradient`: x2 defaults to 100%. */
export function createLinearGradient(global: ViewGlobal, attributes: string): SvgStyleGradient {
  const gradient = newGradient('Linear');
  const linear: SvgLinearGradient = {
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 0,
    isX1Percentage: false,
    isY1Percentage: false,
    isX2Percentage: true,
    isY2Percentage: false,
  };
  gradient.linear = linear;
  simpleXmlParseAttributes(attributes, (key, value) => {
    const coordinate = LINEAR.find(({ tag }) => tag === key);
    if (!coordinate) return readCommon(gradient, key, value);
    const parsed = toGradientLength(value);
    (linear as unknown as Record<string, number | boolean>)[coordinate.key] = parsed.value;
    (linear as unknown as Record<string, number | boolean>)[coordinate.percentageKey] = parsed.isPercentage;
    gradient.flags |= coordinate.flag;
    return true;
  });
  for (const coordinate of LINEAR) recalc(global, linear, coordinate, gradient.userSpace);
  return gradient;
}

/** `_createRadialGradient`: the centre, focus and radius default to 50%, and the focus follows the centre until it is set. */
export function createRadialGradient(global: ViewGlobal, attributes: string): SvgStyleGradient {
  const gradient = newGradient('Radial');
  const radial: SvgRadialGradient = {
    cx: 0.5,
    cy: 0.5,
    fx: 0.5,
    fy: 0.5,
    r: 0.5,
    fr: 0,
    isCxPercentage: true,
    isCyPercentage: true,
    isFxPercentage: true,
    isFyPercentage: true,
    isRPercentage: true,
    isFrPercentage: true,
  };
  gradient.radial = radial;
  let isFxParsed = false;
  let isFyParsed = false;
  simpleXmlParseAttributes(attributes, (key, value) => {
    const coordinate = RADIAL.find(({ tag }) => tag === key);
    if (!coordinate) return readCommon(gradient, key, value);
    const { value: parsed, isPercentage } = toGradientLength(value);
    const record = radial as unknown as Record<string, number | boolean>;
    record[coordinate.key] = parsed;
    record[coordinate.percentageKey] = isPercentage;
    if (key === 'cx' && !isFxParsed) Object.assign(radial, { fx: parsed, isFxPercentage: isPercentage });
    if (key === 'cy' && !isFyParsed) Object.assign(radial, { fy: parsed, isFyPercentage: isPercentage });
    if (key === 'fx') isFxParsed = true;
    if (key === 'fy') isFyParsed = true;
    gradient.flags |= coordinate.flag;
    return true;
  });
  for (const coordinate of RADIAL) recalc(global, radial, coordinate, gradient.userSpace);
  return gradient;
}

/** `_findGradientFactory`. */
export function gradientFactory(tag: string): typeof createLinearGradient | null {
  if (tag === 'linearGradient') return createLinearGradient;
  return tag === 'radialGradient' ? createRadialGradient : null;
}

/** `_cloneGradient`. */
export function cloneGradient(from: SvgStyleGradient): SvgStyleGradient {
  return {
    ...from,
    id: copyId(from.id),
    ref: copyId(from.ref),
    transform: from.transform ? { ...from.transform } : null,
    linear: from.type === 'Linear' && from.linear ? { ...from.linear } : null,
    radial: from.type === 'Radial' && from.radial ? { ...from.radial } : null,
    stops: from.stops.map((stop) => ({ ...stop })),
  };
}

/** `_inheritGradient`: what `to` did not set, taken from `from`, in `to`'s units. */
export function inheritGradient(global: ViewGlobal, to: SvgStyleGradient, from: SvgStyleGradient): void {
  if (!(to.flags & SvgGradientFlags.SpreadMethod) && from.flags & SvgGradientFlags.SpreadMethod) {
    to.spread = from.spread;
    to.flags |= SvgGradientFlags.SpreadMethod;
  }
  const isUnitSet = (to.flags & SvgGradientFlags.GradientUnits) !== 0;
  if (!isUnitSet && from.flags & SvgGradientFlags.GradientUnits) {
    to.userSpace = from.userSpace;
    to.flags |= SvgGradientFlags.GradientUnits;
  }
  if (!to.transform && from.transform) to.transform = { ...from.transform };
  if (to.type === 'Linear' && to.linear && from.linear) {
    for (const coordinate of LINEAR)
      inheritCoordinate(global, to, from, to.linear, from.linear, coordinate, isUnitSet);
  } else if (to.type === 'Radial' && to.radial && from.radial) {
    for (const coordinate of RADIAL) inheritRadialCoordinate(global, to, from, coordinate, isUnitSet);
  }
  if (to.stops.length === 0) to.stops = from.stops.map((stop) => ({ ...stop }));
}

function inheritCoordinate<T>(
  global: ViewGlobal,
  to: SvgStyleGradient,
  from: SvgStyleGradient,
  toValues: T,
  fromValues: T,
  coordinate: Coordinate<T>,
  isUnitSet: boolean
): void {
  const isCoordinateSet = (to.flags & coordinate.flag) !== 0;
  if (!isCoordinateSet && from.flags & coordinate.flag) {
    inherit(toValues, fromValues, coordinate);
    to.flags |= coordinate.flag;
  }
  if (!isUnitSet && isCoordinateSet) recalc(global, toValues, coordinate, to.userSpace);
  if (to.userSpace === from.userSpace) return;
  if (isUnitSet && !isCoordinateSet) recalcInherited(global, toValues, coordinate, to.userSpace);
}

/** A radial coordinate, where an unset focus follows the centre and is not moved into new units. */
function inheritRadialCoordinate(
  global: ViewGlobal,
  to: SvgStyleGradient,
  from: SvgStyleGradient,
  coordinate: Coordinate<SvgRadialGradient>,
  isUnitSet: boolean
): void {
  const radial = to.radial!;
  const isCoordinateSet = (to.flags & coordinate.flag) !== 0;
  if (!isCoordinateSet && from.flags & coordinate.flag) {
    inherit(radial, from.radial!, coordinate);
    to.flags |= coordinate.flag;
  }
  if (!isUnitSet && isCoordinateSet) {
    recalc(global, radial, coordinate, to.userSpace);
    if (coordinate.tag === 'cx' && !(to.flags & SvgGradientFlags.Fx)) radial.fx = radial.cx;
    if (coordinate.tag === 'cy' && !(to.flags & SvgGradientFlags.Fy)) radial.fy = radial.cy;
  }
  if (to.userSpace === from.userSpace) return;
  if (!isUnitSet || isCoordinateSet) return;
  if (coordinate.tag === 'fx' && !(to.flags & SvgGradientFlags.Fx)) return;
  if (coordinate.tag === 'fy' && !(to.flags & SvgGradientFlags.Fy)) return;
  recalcInherited(global, radial, coordinate, to.userSpace);
}
