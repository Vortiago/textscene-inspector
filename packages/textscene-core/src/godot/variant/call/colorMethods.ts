import { namedColor } from '../../math/color.js';
import { clamp, lerpf, round } from '../../math/math.js';
import { okhslToSrgb } from '../../math/okHsl.js';
import { isEqualApproxf } from '../../math/realMath.js';
import { doubleToInt32, int64ToFloat32 } from '../cInteger.js';
import { hexDigitValue } from '../../string/charUtils.js';
import { numberAt, valueAt, type CastArgument } from '../utility/utilityArguments.js';
import { int, variant, type ColorValue, type Variant } from '../value/variant.js';
import { methodPort, staticPort, type MethodParameter, type MethodPort } from './methodPort.js';

const f = Math.fround;
const CHANNELS = ['r', 'g', 'b', 'a'] as const;

const color = (r: number, g: number, b: number, a: number): Variant => variant('COLOR', { r, g, b, a });
const colorOf = (value: ColorValue): Variant => variant('COLOR', value);
const self = (base: Variant) => base.value as ColorValue;
const colorAt = valueAt<ColorValue>;

const port = (
  parameters: readonly MethodParameter[],
  body: (c: ColorValue, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(self(base), args));

// `(uint8_t)` and `(uint16_t)` of a float: cvttss2si to int32, then the low bits.
const quantised = (channel: number, scale: number, mask: number) =>
  doubleToInt32(round(f(channel * scale))) & mask;
const byte = (channel: number) => quantised(channel, 255, 0xff);
const word = (channel: number) => BigInt(quantised(channel, 65535, 0xffff));

const packed32 = (channels: readonly number[]) =>
  channels.reduce((packed, channel) => ((packed << 8) | byte(channel)) >>> 0, 0);
const packed64 = (channels: readonly number[]) =>
  BigInt.asIntN(
    64,
    channels.reduce((packed, channel) => (packed << 16n) | word(channel), 0n)
  );

function htmlHex(channel: number): string {
  return clamp(doubleToInt32(round(f(channel * 255))), 0, 255)
    .toString(16)
    .padStart(2, '0');
}

// color.cpp:308: `char character = p_str[p_ofs]` keeps the low byte, and a byte past 127 is negative.
function hexDigit(codePoint: number | undefined): number {
  const low = (codePoint ?? 0) & 0xff;
  if (low >= 0x30 && low <= 0x39) return low - 0x30;
  if (low >= 0x61 && low <= 0x66) return low - 0x61 + 10;
  if (low >= 0x41 && low <= 0x46) return low - 0x41 + 10;
  return -1;
}

const BLACK: ColorValue = { r: 0, g: 0, b: 0, a: 1 };

/** `Color::html` (color.cpp:331): a digit that is not hex reads as -1, and a negative channel fails. */
function html(text: string): ColorValue {
  const codePoints = Array.from(text, (character) => character.codePointAt(0)!);
  if (codePoints.length === 0) return BLACK;
  const start = codePoints[0] === 0x23 ? 1 : 0;
  const digit = (offset: number) => hexDigit(codePoints[start + offset]);
  const pair = (offset: number) => digit(offset) * 16 + digit(offset + 1);
  let channels: number[];
  switch (codePoints.length - start) {
    case 3:
      channels = [0, 1, 2].map((offset) => f(digit(offset) / 15)).concat(1);
      break;
    case 4:
      channels = [0, 1, 2, 3].map((offset) => f(digit(offset) / 15));
      break;
    case 6:
      channels = [0, 2, 4].map((offset) => f(pair(offset) / 255)).concat(1);
      break;
    case 8:
      channels = [0, 2, 4, 6].map((offset) => f(pair(offset) / 255));
      break;
    default:
      return BLACK;
  }
  if (channels.some((channel) => channel < 0)) return BLACK;
  const [r, g, b, a] = channels as [number, number, number, number];
  return { r, g, b, a };
}

export function isHtmlValid(text: string): boolean {
  const characters = Array.from(text);
  if (characters.length === 0) return false;
  const start = characters[0] === '#' ? 1 : 0;
  if (![3, 4, 6, 8].includes(characters.length - start)) return false;
  return characters.slice(start).every((character) => hexDigitValue(character) !== undefined);
}

function fromString(text: string, fallback: ColorValue): ColorValue {
  if (isHtmlValid(text)) return html(text);
  const named = namedColor(text);
  return named ? { r: f(named.r), g: f(named.g), b: f(named.b), a: f(named.a) } : fallback;
}

/** `Color::set_hsv` (color.cpp:182) in float: a negative hue falls to the last sector, as `floor` gives. */
function fromHsv(h: number, s: number, v: number, alpha: number): ColorValue {
  if (s === 0) return { r: v, g: v, b: v, a: alpha };
  const sector = f(f(h * 6) % 6);
  const i = doubleToInt32(Math.floor(sector));
  const fraction = f(sector - i);
  const p = f(v * f(1 - s));
  const q = f(v * f(1 - f(s * fraction)));
  const t = f(v * f(1 - f(s * f(1 - fraction))));
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
  ][i] ?? [v, p, q];
  return { r: r!, g: g!, b: b!, a: alpha };
}

function fromOkHsl(h: number, s: number, l: number, alpha: number): ColorValue {
  const rgb = okhslToSrgb({ h, s, l });
  return { r: clamp(rgb.r, 0, 1), g: clamp(rgb.g, 0, 1), b: clamp(rgb.b, 0, 1), a: clamp(alpha, 0, 1) };
}

function fromRgbe9995(rgbe: number): ColorValue {
  const exponent = rgbe >>> 27;
  const scale = f(Math.pow(2, f(f(exponent - 15) - 9)));
  const channel = (shift: number) => f(((rgbe >>> shift) & 0x1ff) * scale);
  return { r: channel(0), g: channel(9), b: channel(18), a: 1 };
}

function blend(under: ColorValue, over: ColorValue): ColorValue {
  const kept = f(1 - over.a);
  const a = f(f(under.a * kept) + over.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (u: number, o: number) => f(f(f(f(u * under.a) * kept) + f(o * over.a)) / a);
  return { r: mix(under.r, over.r), g: mix(under.g, over.g), b: mix(under.b, over.b), a };
}

const SRGB_KNEE = f(0.04045);
const LINEAR_SLOPE = f(1 / f(12.92));
const LINEAR_KNEE = f(0.0031308);
const SRGB_EXPONENT = f(1 / f(2.4));

// color.h:194: the shifted channel is a double, narrowed to float before powf.
const toLinear = (c: number) =>
  c < SRGB_KNEE ? f(c * LINEAR_SLOPE) : f(Math.pow(f((c + 0.055) * (1 / 1.055)), f(2.4)));
const toSrgb = (c: number) =>
  c < LINEAR_KNEE ? f(f(12.92) * c) : f(1.055 * f(Math.pow(c, SRGB_EXPONENT)) - 0.055);

const eachRgb = (c: ColorValue, map: (channel: number) => number): Variant =>
  color(map(c.r), map(c.g), map(c.b), c.a);

export const COLOR_METHODS: Readonly<Record<string, MethodPort>> = {
  to_argb32: port([], (c) => int(packed32([c.a, c.r, c.g, c.b]))),
  to_abgr32: port([], (c) => int(packed32([c.a, c.b, c.g, c.r]))),
  to_rgba32: port([], (c) => int(packed32([c.r, c.g, c.b, c.a]))),
  to_argb64: port([], (c) => int(packed64([c.a, c.r, c.g, c.b]))),
  to_abgr64: port([], (c) => int(packed64([c.a, c.b, c.g, c.r]))),
  to_rgba64: port([], (c) => int(packed64([c.r, c.g, c.b, c.a]))),
  to_html: port(['bool'], (c, [withAlpha]) =>
    variant('STRING', [c.r, c.g, c.b, ...(withAlpha ? [c.a] : [])].map(htmlHex).join(''))
  ),
  clamp: port(['COLOR', 'COLOR'], (c, args) => {
    const [min, max] = [colorAt(args, 0), colorAt(args, 1)];
    const [r, g, b, a] = CHANNELS.map((channel) => clamp(c[channel], min[channel], max[channel]));
    return color(r!, g!, b!, a!);
  }),
  inverted: port([], (c) => eachRgb(c, (channel) => f(1 - channel))),
  lerp: port(['COLOR', 'float'], (c, args) => {
    const to = colorAt(args, 0);
    const [r, g, b, a] = CHANNELS.map((channel) => lerpf(c[channel], to[channel], numberAt(args, 1)));
    return color(r!, g!, b!, a!);
  }),
  lightened: port(['float'], (c, args) =>
    eachRgb(c, (channel) => f(channel + f(f(1 - channel) * numberAt(args, 0))))
  ),
  darkened: port(['float'], (c, args) => eachRgb(c, (channel) => f(channel * f(1 - numberAt(args, 0))))),
  blend: port(['COLOR'], (c, args) => colorOf(blend(c, colorAt(args, 0)))),
  get_luminance: port([], (c) =>
    variant('FLOAT', f(f(f(f(0.2126) * c.r) + f(f(0.7152) * c.g)) + f(f(0.0722) * c.b)))
  ),
  srgb_to_linear: port([], (c) => eachRgb(c, toLinear)),
  linear_to_srgb: port([], (c) => eachRgb(c, toSrgb)),
  is_equal_approx: port(['COLOR'], (c, args) => {
    const other = colorAt(args, 0);
    return variant(
      'BOOL',
      CHANNELS.every((channel) => isEqualApproxf(c[channel], other[channel]))
    );
  }),
  hex: staticPort(['uint32_t'], ([hex]) => {
    const [r, g, b, a] = [24, 16, 8, 0].map((shift) => f((((hex as number) >>> shift) & 0xff) / 255));
    return color(r!, g!, b!, a!);
  }),
  hex64: staticPort(['uint64_t'], ([hex]) => {
    const [r, g, b, a] = [48n, 32n, 16n, 0n].map((shift) =>
      f(Number(((hex as bigint) >> shift) & 0xffffn) / 65535)
    );
    return color(r!, g!, b!, a!);
  }),
  html: staticPort(['String'], ([text]) => colorOf(html(text as string))),
  html_is_valid: staticPort(['String'], ([text]) => variant('BOOL', isHtmlValid(text as string))),
  from_string: staticPort(['String', 'COLOR'], (args) =>
    colorOf(fromString(args[0] as string, colorAt(args, 1)))
  ),
  from_hsv: staticPort(['float', 'float', 'float', 'float'], (args) => {
    const [h, s, v, alpha] = [0, 1, 2, 3].map((index) => numberAt(args, index));
    return colorOf(fromHsv(h!, s!, v!, alpha!));
  }),
  from_ok_hsl: staticPort(['float', 'float', 'float', 'float'], (args) => {
    const [h, s, l, alpha] = [0, 1, 2, 3].map((index) => numberAt(args, index));
    return colorOf(fromOkHsl(h!, s!, l!, alpha!));
  }),
  from_rgbe9995: staticPort(['uint32_t'], ([rgbe]) => colorOf(fromRgbe9995(rgbe as number))),
  from_rgba8: staticPort(['int64_t', 'int64_t', 'int64_t', 'int64_t'], (args) => {
    const [r, g, b, a] = [0, 1, 2, 3].map((index) => f(int64ToFloat32(args[index] as bigint) / 255));
    return color(r!, g!, b!, a!);
  }),
};
