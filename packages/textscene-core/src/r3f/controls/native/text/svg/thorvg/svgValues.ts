/**
 * The attribute values ThorVG's SVG loader reads (`tvgSvgLoader.cpp:62-930`): lengths with their
 * units, opacities, colours, dash arrays, URL references and transforms, each with ThorVG's own
 * rules for what it accepts.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { deg2rad, f32, identityMatrix, isEqual, isZero, matrix, multiply, type Matrix } from './math';
import { NAMED_COLOURS } from './namedColours';
import type {
  AspectRatioAlign,
  AspectRatioMeetOrSlice,
  FillRule,
  FillSpread,
  StrokeCap,
  StrokeJoin,
  SvgColor,
  SvgMaskType,
} from './svgNode';
import { strToFloat } from './strToFloat';
import { isSpace } from './xmlParser';

/** Pixels per unit (`PX_PER_IN` and the others, `tvgSvgLoader.cpp:69-73`). */
const PX_PER_IN = 96;
const PX_PER_PC = 16;
const PX_PER_PT = f32(1.333333);
const PX_PER_MM = f32(3.779528);
const PX_PER_CM = f32(37.79528);

/** What a percentage length is a share of (`SvgParserLengthType`). */
export type LengthType = 'Vertical' | 'Horizontal' | 'Diagonal' | 'Other';

/** The view a percentage refers to (`SvgParser::global`). */
export interface ViewGlobal {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const skipSpace = (text: string, at: number): number => {
  while (isSpace(text[at])) at++;
  return at;
};

/** `_skipComma`: past white space and one comma. */
export function skipComma(text: string, at: number): number {
  at = skipSpace(text, at);
  return text[at] === ',' ? at + 1 : at;
}

/** `_parseNumber`: a number, where it ends, and where the next one starts past a comma; null for none. */
export function parseNumber(text: string, at: number): { value: number; end: number; next: number } | null {
  const { value, end } = strToFloat(text, at);
  if (end === at) return null;
  return { value, end, next: skipComma(text, end) };
}

/** The diagonal of the view over the square root of two, which a diagonal percentage is a share of. */
export function viewDiagonal(global: ViewGlobal): number {
  return f32(f32(Math.sqrt(f32(f32(global.w ** 2) + f32(global.h ** 2)))) / f32(Math.sqrt(2)));
}

/** `_toFloat`: a length in pixels, its unit found anywhere in the text as ThorVG does. */
export function toLength(global: ViewGlobal, text: string, type: LengthType): number {
  const value = strToFloat(text).value;
  if (text.includes('cm')) return f32(value * PX_PER_CM);
  if (text.includes('mm')) return f32(value * PX_PER_MM);
  if (text.includes('pt')) return f32(value * PX_PER_PT);
  if (text.includes('pc')) return f32(value * PX_PER_PC);
  if (text.includes('in')) return f32(value * PX_PER_IN);
  if (!text.includes('%')) return value;
  const share = f32(value / 100);
  switch (type) {
    case 'Vertical':
      return f32(share * global.h);
    case 'Horizontal':
      return f32(share * global.w);
    case 'Diagonal':
      return f32(viewDiagonal(global) * share);
    case 'Other':
      return f32(share * Math.max(global.w, global.h));
  }
}

/** `_gradientToFloat`: a gradient coordinate, a percentage kept as a fraction. */
export function toGradientLength(text: string): { value: number; isPercentage: boolean } {
  const value = strToFloat(text).value;
  if (text.includes('%')) return { value: f32(value / 100), isPercentage: true };
  if (text.includes('cm')) return { value: f32(value * PX_PER_CM), isPercentage: false };
  if (text.includes('mm')) return { value: f32(value * PX_PER_MM), isPercentage: false };
  if (text.includes('pt')) return { value: f32(value * PX_PER_PT), isPercentage: false };
  if (text.includes('pc')) return { value: f32(value * PX_PER_PC), isPercentage: false };
  if (text.includes('in')) return { value: f32(value * PX_PER_IN), isPercentage: false };
  return { value, isPercentage: false };
}

/** `_toOffset`: a stop offset, or 0 for one with anything after the number but a final `%`. */
export function toOffset(text: string): number {
  const { value, end: numberEnd } = strToFloat(text);
  const end = skipSpace(text, numberEnd);
  const percent = text.indexOf('%');
  if (percent >= 0) {
    if (end !== percent || end + 1 !== text.length) return 0;
    return f32(value / 100);
  }
  return end === text.length ? value : 0;
}

/** `lrint`: the nearest integer, a tie to even. */
export function lrint(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}

/** `_toOpacity`: 0 to 255, or 255 for text that is not a number or a percentage alone. */
export function toOpacity(text: string): number {
  const { value, end } = strToFloat(text);
  if (text[end] === '%' && end + 1 === text.length) return lrint(f32(value * f32(2.55)));
  if (end === text.length) return lrint(f32(value * 255));
  return 255;
}

export const toMaskType = (text: string): SvgMaskType => (text === 'Alpha' ? 'Alpha' : 'Luminance');

/** `_toPaintOrder`: true where the fill comes before the stroke. */
export function toPaintOrder(text: string): boolean {
  let position = 1;
  let strokePosition = 0;
  let fillPosition = 0;
  let at = 0;
  while (at < text.length) {
    at = skipSpace(text, at);
    if (text.startsWith('fill', at)) {
      fillPosition = position++;
      at += 4;
    } else if (text.startsWith('stroke', at)) {
      strokePosition = position++;
      at += 6;
    } else if (text.startsWith('markers', at)) {
      at += 7;
    } else {
      return true;
    }
  }
  if (fillPosition === 0) fillPosition = position++;
  if (strokePosition === 0) strokePosition = position;
  return fillPosition < strokePosition;
}

const LINE_CAPS: Readonly<Record<string, StrokeCap>> = { butt: 'Butt', round: 'Round', square: 'Square' };
const LINE_JOINS: Readonly<Record<string, StrokeJoin>> = { miter: 'Miter', round: 'Round', bevel: 'Bevel' };

export const toLineCap = (text: string): StrokeCap =>
  Object.hasOwn(LINE_CAPS, text) ? LINE_CAPS[text]! : 'Butt';
export const toLineJoin = (text: string): StrokeJoin =>
  Object.hasOwn(LINE_JOINS, text) ? LINE_JOINS[text]! : 'Miter';
export const toFillRule = (text: string): FillRule => (text === 'evenodd' ? 'EvenOdd' : 'Winding');

export function toSpread(text: string): FillSpread {
  if (text === 'reflect') return 'Reflect';
  return text === 'repeat' ? 'Repeat' : 'Pad';
}

/** `_parseDashArray`: the dashes and gaps, a single value doubled, stopping at the first that is not positive. */
export function parseDashArray(global: ViewGlobal, text: string, dashes: number[]): void {
  if (text.startsWith('none')) return;
  let at = 0;
  while (at < text.length) {
    at = skipComma(text, at);
    const { value, end } = strToFloat(text, at);
    if (end === at || value <= 0) break;
    let dash = value;
    let next = end;
    if (text[end] === '%') {
      next++;
      dash = f32(viewDiagonal(global) * f32(value / 100));
    }
    dashes.push(dash);
    at = next;
  }
  if (dashes.length === 1) dashes.push(dashes[0]!);
}

/** `_idFromUrl`: the id inside `(#id)`, or null for a reference ThorVG does not read. */
export function idFromUrl(url: string): string | null {
  const open = url.indexOf('(');
  let close = url.indexOf(')');
  if (open < 0 || close < 0 || open >= close) return null;
  let start = url.indexOf('#');
  if (start < 0 || start >= close) return null;
  start++;
  close--;
  while (start < close && (url[close] === ' ' || url[close] === "'" || url[close] === '"')) close--;
  for (let at = start; at < close; at++) if (url[at] === ' ' || url[at] === "'") return null;
  return url.slice(start, close + 1);
}

/** `_srcFromUrl`: the quoted source inside `url('...')`, trimmed, or null. */
export function srcFromUrl(url: string): string | null {
  const open = url.indexOf('(');
  let close = url.indexOf(')');
  if (open < 0 || close < 0 || open >= close) return null;
  let start = url.indexOf("'", open);
  if (start < 0 || start >= close) return null;
  start++;
  close = url.indexOf("'", start);
  if (close < 0 || close === start) return null;
  close--;
  while (start < close && url[start] === ' ') start++;
  while (start < close && url[close] === ' ') close--;
  return url.slice(start, close + 1);
}

/** `_idFromHref`: the reference without its leading `#`. */
export function idFromHref(href: string): string {
  const at = skipSpace(href, 0);
  return href.slice(href[at] === '#' ? at + 1 : at);
}

/** `_parseAspectRatio`: an alignment, and `meet` or `slice` where the rest of the text is that alone. */
export function parseAspectRatio(
  text: string,
  ratio: { align: AspectRatioAlign; meetOrSlice: AspectRatioMeetOrSlice }
): void {
  if (text === 'none') {
    ratio.align = 'None';
    return;
  }
  let rest = text;
  for (const align of ALIGNS) {
    if (text.startsWith(align.charAt(0).toLowerCase() + align.slice(1))) {
      ratio.align = align;
      rest = text.slice(skipSpace(text, 8));
      break;
    }
  }
  if (rest === 'meet') ratio.meetOrSlice = 'Meet';
  else if (rest === 'slice') ratio.meetOrSlice = 'Slice';
}

const ALIGNS: readonly AspectRatioAlign[] = [
  'XMinYMin',
  'XMidYMin',
  'XMaxYMin',
  'XMinYMid',
  'XMidYMid',
  'XMaxYMid',
  'XMinYMax',
  'XMidYMax',
  'XMaxYMax',
];

const isHexDigit = (character: string | undefined): boolean =>
  character !== undefined && /^[0-9a-fA-F]$/.test(character);

/** `_parseColor`: one `rgb()` channel, a percentage of 255 or a number, or null outside 0 to 255. */
function parseChannel(text: string, at: number): { value: number; end: number } | null {
  const parsed = strToFloat(text, at);
  let value = parsed.value;
  let end = skipSpace(text, parsed.end);
  if (text[end] === '%') {
    value = f32(f32(255 * value) / 100);
    end++;
  }
  end = skipSpace(text, end);
  if (value < 0 || value > 255) return null;
  return { value: lrint(value), end };
}

/** What `_toColor` read: a colour, a URL reference, or a value it reads as neither. */
export type ParsedColour =
  | { readonly kind: 'colour'; readonly colour: SvgColor | null }
  | { readonly kind: 'url'; readonly id: string | null }
  | { readonly kind: 'none' };

/**
 * `_toColor`. A `kind: 'colour'` with a null colour is text ThorVG accepts without setting a
 * colour, such as `#12g`, and a reader that takes no URL reads `url(...)` as a named colour.
 */
export function toColour(text: string, readsUrl: boolean): ParsedColour {
  const length = text.length;
  if (length === 4 && text[0] === '#') {
    if (![1, 2, 3].every((i) => isHexDigit(text[i]))) return { kind: 'colour', colour: null };
    const channel = (i: number): number => parseInt(text[i]! + text[i]!, 16);
    return { kind: 'colour', colour: { r: channel(1), g: channel(2), b: channel(3) } };
  }
  if (length === 7 && text[0] === '#') {
    if (![1, 2, 3, 4, 5, 6].every((i) => isHexDigit(text[i]))) return { kind: 'colour', colour: null };
    const channel = (i: number): number => parseInt(text.slice(i, i + 2), 16);
    return { kind: 'colour', colour: { r: channel(1), g: channel(3), b: channel(5) } };
  }
  if (length >= 10 && /^rgb\(/i.test(text) && text[length - 1] === ')')
    return { kind: 'colour', colour: rgbColour(text) };
  if (readsUrl && length >= 3 && text.startsWith('url')) return { kind: 'url', id: idFromUrl(text.slice(3)) };
  if (length >= 10 && /^hsl\(/i.test(text) && text[length - 1] === ')') {
    const colour = hslColour(text);
    return colour ? { kind: 'colour', colour } : { kind: 'none' };
  }
  const named = NAMED_COLOURS.get(text.toLowerCase());
  if (named === undefined) return { kind: 'none' };
  return { kind: 'colour', colour: { r: named >> 16, g: (named >> 8) & 0xff, b: named & 0xff } };
}

/** `rgb(r, g, b)`, or null where a channel or the separators do not read. */
function rgbColour(text: string): SvgColor | null {
  const red = parseChannel(text, 4);
  if (!red || text[red.end] !== ',') return null;
  const green = parseChannel(text, red.end + 1);
  if (!green || text[green.end] !== ',') return null;
  const blue = parseChannel(text, green.end + 1);
  if (!blue || text[blue.end] !== ')' || blue.end + 1 !== text.length) return null;
  return { r: red.value, g: green.value, b: blue.value };
}

/** `hsl(h, s%, l%)`, or null where it does not read. */
function hslColour(text: string): SvgColor | null {
  const hue = parseNumber(text, skipSpace(text, 4));
  if (!hue) return null;
  const saturationAt = skipSpace(text, skipComma(text, skipSpace(text, hue.end)));
  const saturation = parseNumber(text, saturationAt);
  if (!saturation || text[saturation.end] !== '%') return null;
  const lightnessAt = skipSpace(text, skipComma(text, skipSpace(text, saturation.end + 1)));
  const lightness = parseNumber(text, lightnessAt);
  if (!lightness || text[lightness.end] !== '%') return null;
  const closeAt = skipSpace(text, lightness.end + 1);
  if (text[closeAt] !== ')' || closeAt + 1 !== text.length) return null;
  return hslToRgb(hue.value, f32(saturation.value / 100), f32(lightness.value / 100));
}

/** `_hslToRgb`, in single precision. */
export function hslToRgb(hue: number, saturation: number, brightness: number): SvgColor {
  while (hue < 0) hue = f32(hue + 360);
  hue = f32(hue % 360);
  saturation = saturation > 0 ? Math.min(saturation, 1) : 0;
  brightness = brightness > 0 ? Math.min(brightness, 1) : 0;
  let red: number;
  let green: number;
  let blue: number;
  if (isZero(saturation)) {
    red = green = blue = brightness;
  } else {
    if (isEqual(hue, 360)) hue = 0;
    hue = f32(hue / 60);
    const v =
      brightness <= 0.5
        ? f32(brightness * f32(1 + saturation))
        : f32(f32(brightness + saturation) - f32(brightness * saturation));
    const p = f32(f32(brightness + brightness) - v);
    const sv = isZero(v) ? 0 : f32(f32(v - p) / v);
    const sector = Math.trunc(hue) & 0xff;
    const fraction = f32(hue - sector);
    const vsf = f32(f32(v * sv) * fraction);
    const t = f32(p + vsf);
    const q = f32(v - vsf);
    const sectors: readonly (readonly [number, number, number])[] = [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q],
    ];
    [red, green, blue] = sectors[sector] ?? [0, 0, 0];
  }
  const channel = (value: number): number => nearbyintByte(f32(value * 255));
  return { r: channel(red), g: channel(green), b: channel(blue) };
}

/** `(uint8_t)nearbyint(value)` for a value in 0 to 255. */
function nearbyintByte(value: number): number {
  return lrint(value) & 0xff;
}

/** `_parseNumbersArray`: up to `max` numbers, each started by a digit, a sign or a dot. */
function parseNumbersArray(text: string, at: number, max: number): { numbers: number[]; end: number } {
  const numbers: number[] = [];
  at = skipSpace(text, at);
  while (numbers.length < max && /[0-9+\-.]/.test(text[at] ?? '')) {
    const { value, end } = strToFloat(text, at);
    numbers.push(value);
    at = skipSpace(text, end);
    if (text[at] === ',') at++;
    at = skipSpace(text, at);
  }
  return { numbers, end: at };
}

const TRANSFORMS = ['matrix', 'translate', 'rotate', 'scale', 'skewX', 'skewY'] as const;

/** The most numbers a transform function reads (`POINT_CNT`). */
const MAX_TRANSFORM_NUMBERS = 8;

/** `_parseTransformationMatrix`: the product of a transform list, or null for one ThorVG rejects. */
export function parseTransform(text: string): Matrix | null {
  let m = identityMatrix();
  let at = 0;
  while (at < text.length) {
    if (isSpace(text[at]) || text[at] === ',') {
      at++;
      continue;
    }
    const name = TRANSFORMS.find((candidate) => text.startsWith(candidate, at));
    if (!name) return null;
    at = skipSpace(text, at + name.length);
    if (text[at] !== '(') return null;
    const { numbers, end } = parseNumbersArray(text, at + 1, MAX_TRANSFORM_NUMBERS);
    if (text[end] !== ')') return null;
    at = end + 1;
    const step = transformStep(name, numbers);
    if (!step) return null;
    for (const factor of step) m = multiply(m, factor);
  }
  return m;
}

/** The matrices one transform function multiplies in, or null for the wrong count of numbers. */
function transformStep(name: (typeof TRANSFORMS)[number], p: number[]): Matrix[] | null {
  const count = p.length;
  switch (name) {
    case 'matrix':
      return count === 6 ? [matrix(p[0]!, p[2]!, p[4]!, p[1]!, p[3]!, p[5]!, 0, 0, 1)] : null;
    case 'translate':
      if (count === 1) return [matrix(1, 0, p[0]!, 0, 1, 0, 0, 0, 1)];
      return count === 2 ? [matrix(1, 0, p[0]!, 0, 1, p[1]!, 0, 0, 1)] : null;
    case 'rotate':
      return rotation(p);
    case 'scale':
      if (count < 1 || count > 2) return null;
      return [matrix(p[0]!, 0, 0, 0, count === 2 ? p[1]! : p[0]!, 0, 0, 0, 1)];
    case 'skewX':
      return count === 1 ? [matrix(1, f32(Math.tan(deg2rad(p[0]!))), 0, 0, 1, 0, 0, 0, 1)] : null;
    case 'skewY':
      return count === 1 ? [matrix(1, 0, 0, f32(Math.tan(deg2rad(p[0]!))), 1, 0, 0, 0, 1)] : null;
  }
}

/** `rotate(a)` or `rotate(a, x, y)`, its angle first brought into 0 to 360. */
function rotation(p: number[]): Matrix[] | null {
  if (p.length !== 1 && p.length !== 3) return null;
  let degrees = f32(p[0]! % 360);
  if (degrees < 0) degrees = f32(degrees + 360);
  const c = f32(Math.cos(deg2rad(degrees)));
  const s = f32(Math.sin(deg2rad(degrees)));
  const turn = matrix(c, -s, 0, s, c, 0, 0, 0, 1);
  if (p.length === 1) return [turn];
  return [matrix(1, 0, p[1]!, 0, 1, p[2]!, 0, 0, 1), turn, matrix(1, 0, -p[1]!, 0, 1, -p[2]!, 0, 0, 1)];
}
