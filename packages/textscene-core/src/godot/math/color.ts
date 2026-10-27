/**
 * Godot's `Color` in plain channels: the strings a COLOR slot converts, and the colour a theme
 * derives by `darkened` or `lightened`. `Color(const String &)` reads HTML hex when
 * `html_is_valid` passes, and a colour name otherwise (`color.h:274-280`).
 *
 * The named-colour table is ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from './math.js';

/**
 * `named_colors[]` (`color_names.inc:49-196`): normalised name to `0xRRGGBBAA`. Keys drop the
 * underscores, as `find_named_color` builds its hash map (`color.cpp:418-424`). Values are the
 * source's own literals, to diff by eye.
 */
const NAMED_COLORS: Readonly<Record<string, number>> = {
  ALICEBLUE: 0xf0f8ffff,
  ANTIQUEWHITE: 0xfaebd7ff,
  AQUA: 0x00ffffff,
  AQUAMARINE: 0x7fffd4ff,
  AZURE: 0xf0ffffff,
  BEIGE: 0xf5f5dcff,
  BISQUE: 0xffe4c4ff,
  BLACK: 0x000000ff,
  BLANCHEDALMOND: 0xffebcdff,
  BLUE: 0x0000ffff,
  BLUEVIOLET: 0x8a2be2ff,
  BROWN: 0xa52a2aff,
  BURLYWOOD: 0xdeb887ff,
  CADETBLUE: 0x5f9ea0ff,
  CHARTREUSE: 0x7fff00ff,
  CHOCOLATE: 0xd2691eff,
  CORAL: 0xff7f50ff,
  CORNFLOWERBLUE: 0x6495edff,
  CORNSILK: 0xfff8dcff,
  CRIMSON: 0xdc143cff,
  CYAN: 0x00ffffff,
  DARKBLUE: 0x00008bff,
  DARKCYAN: 0x008b8bff,
  DARKGOLDENROD: 0xb8860bff,
  DARKGRAY: 0xa9a9a9ff,
  DARKGREEN: 0x006400ff,
  DARKKHAKI: 0xbdb76bff,
  DARKMAGENTA: 0x8b008bff,
  DARKOLIVEGREEN: 0x556b2fff,
  DARKORANGE: 0xff8c00ff,
  DARKORCHID: 0x9932ccff,
  DARKRED: 0x8b0000ff,
  DARKSALMON: 0xe9967aff,
  DARKSEAGREEN: 0x8fbc8fff,
  DARKSLATEBLUE: 0x483d8bff,
  DARKSLATEGRAY: 0x2f4f4fff,
  DARKTURQUOISE: 0x00ced1ff,
  DARKVIOLET: 0x9400d3ff,
  DEEPPINK: 0xff1493ff,
  DEEPSKYBLUE: 0x00bfffff,
  DIMGRAY: 0x696969ff,
  DODGERBLUE: 0x1e90ffff,
  FIREBRICK: 0xb22222ff,
  FLORALWHITE: 0xfffaf0ff,
  FORESTGREEN: 0x228b22ff,
  FUCHSIA: 0xff00ffff,
  GAINSBORO: 0xdcdcdcff,
  GHOSTWHITE: 0xf8f8ffff,
  GOLD: 0xffd700ff,
  GOLDENROD: 0xdaa520ff,
  GRAY: 0xbebebeff,
  GREEN: 0x00ff00ff,
  GREENYELLOW: 0xadff2fff,
  HONEYDEW: 0xf0fff0ff,
  HOTPINK: 0xff69b4ff,
  INDIANRED: 0xcd5c5cff,
  INDIGO: 0x4b0082ff,
  IVORY: 0xfffff0ff,
  KHAKI: 0xf0e68cff,
  LAVENDER: 0xe6e6faff,
  LAVENDERBLUSH: 0xfff0f5ff,
  LAWNGREEN: 0x7cfc00ff,
  LEMONCHIFFON: 0xfffacdff,
  LIGHTBLUE: 0xadd8e6ff,
  LIGHTCORAL: 0xf08080ff,
  LIGHTCYAN: 0xe0ffffff,
  LIGHTGOLDENROD: 0xfafad2ff,
  LIGHTGRAY: 0xd3d3d3ff,
  LIGHTGREEN: 0x90ee90ff,
  LIGHTPINK: 0xffb6c1ff,
  LIGHTSALMON: 0xffa07aff,
  LIGHTSEAGREEN: 0x20b2aaff,
  LIGHTSKYBLUE: 0x87cefaff,
  LIGHTSLATEGRAY: 0x778899ff,
  LIGHTSTEELBLUE: 0xb0c4deff,
  LIGHTYELLOW: 0xffffe0ff,
  LIME: 0x00ff00ff,
  LIMEGREEN: 0x32cd32ff,
  LINEN: 0xfaf0e6ff,
  MAGENTA: 0xff00ffff,
  MAROON: 0xb03060ff,
  MEDIUMAQUAMARINE: 0x66cdaaff,
  MEDIUMBLUE: 0x0000cdff,
  MEDIUMORCHID: 0xba55d3ff,
  MEDIUMPURPLE: 0x9370dbff,
  MEDIUMSEAGREEN: 0x3cb371ff,
  MEDIUMSLATEBLUE: 0x7b68eeff,
  MEDIUMSPRINGGREEN: 0x00fa9aff,
  MEDIUMTURQUOISE: 0x48d1ccff,
  MEDIUMVIOLETRED: 0xc71585ff,
  MIDNIGHTBLUE: 0x191970ff,
  MINTCREAM: 0xf5fffaff,
  MISTYROSE: 0xffe4e1ff,
  MOCCASIN: 0xffe4b5ff,
  NAVAJOWHITE: 0xffdeadff,
  NAVYBLUE: 0x000080ff,
  OLDLACE: 0xfdf5e6ff,
  OLIVE: 0x808000ff,
  OLIVEDRAB: 0x6b8e23ff,
  ORANGE: 0xffa500ff,
  ORANGERED: 0xff4500ff,
  ORCHID: 0xda70d6ff,
  PALEGOLDENROD: 0xeee8aaff,
  PALEGREEN: 0x98fb98ff,
  PALETURQUOISE: 0xafeeeeff,
  PALEVIOLETRED: 0xdb7093ff,
  PAPAYAWHIP: 0xffefd5ff,
  PEACHPUFF: 0xffdab9ff,
  PERU: 0xcd853fff,
  PINK: 0xffc0cbff,
  PLUM: 0xdda0ddff,
  POWDERBLUE: 0xb0e0e6ff,
  PURPLE: 0xa020f0ff,
  REBECCAPURPLE: 0x663399ff,
  RED: 0xff0000ff,
  ROSYBROWN: 0xbc8f8fff,
  ROYALBLUE: 0x4169e1ff,
  SADDLEBROWN: 0x8b4513ff,
  SALMON: 0xfa8072ff,
  SANDYBROWN: 0xf4a460ff,
  SEAGREEN: 0x2e8b57ff,
  SEASHELL: 0xfff5eeff,
  SIENNA: 0xa0522dff,
  SILVER: 0xc0c0c0ff,
  SKYBLUE: 0x87ceebff,
  SLATEBLUE: 0x6a5acdff,
  SLATEGRAY: 0x708090ff,
  SNOW: 0xfffafaff,
  SPRINGGREEN: 0x00ff7fff,
  STEELBLUE: 0x4682b4ff,
  TAN: 0xd2b48cff,
  TEAL: 0x008080ff,
  THISTLE: 0xd8bfd8ff,
  TOMATO: 0xff6347ff,
  TRANSPARENT: 0xffffff00,
  TURQUOISE: 0x40e0d0ff,
  VIOLET: 0xee82eeff,
  WEBGRAY: 0x808080ff,
  WEBGREEN: 0x008000ff,
  WEBMAROON: 0x800000ff,
  WEBPURPLE: 0x800080ff,
  WHEAT: 0xf5deb3ff,
  WHITE: 0xffffffff,
  WHITESMOKE: 0xf5f5f5ff,
  YELLOW: 0xffff00ff,
  YELLOWGREEN: 0x9acd32ff,
};

/** `Color::html_is_valid`: an optional `#`, then 3, 4, 6 or 8 hex digits (`color.cpp:372-394`). */
const HTML_COLOR_RE = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** `find_named_color`'s normalisation: drop ` -_'.`, then upper-case (`color.cpp:413-416`). */
function normalisedColorName(text: string): string {
  return text.replace(/[ \-_'.]/g, '').toUpperCase();
}

/**
 * Whether `Color(const String &)` reads this decoded string as a colour. When it
 * does not, `Color::named` fails with `ERR_FAIL_V_MSG` and yields `Color()`
 * (`color.cpp:396-402`), so the slot stores black rather than what the file says.
 */
export function isColorString(text: string): boolean {
  return HTML_COLOR_RE.test(text) || normalisedColorName(text) in NAMED_COLORS;
}

/**
 * `Color::named` (`color.cpp:404-410`) without its fallback argument: nothing on a miss, so each
 * caller applies the default its own `Color::from_string` call site passes.
 */
export function namedColor(name: string): Rgba | undefined {
  const packed = NAMED_COLORS[normalisedColorName(name)];
  if (packed === undefined) return undefined;
  return {
    r: ((packed >>> 24) & 0xff) / 255,
    g: ((packed >>> 16) & 0xff) / 255,
    b: ((packed >>> 8) & 0xff) / 255,
    a: (packed & 0xff) / 255,
  };
}

/** The colour channels `darkened` and `lightened` change. Alpha, when present, stays. */
interface ColorChannels {
  r: number;
  g: number;
  b: number;
}

/**
 * `Color::darkened` (`core/math/color.h:119-125`): each colour channel shrinks by `amount`.
 * Double, not float, as the callers' colours are.
 *
 * @canonical A darker or lighter colour
 */
export function darkened<C extends ColorChannels>(color: C, amount: number): C {
  const kept = 1 - amount;
  return { ...color, r: color.r * kept, g: color.g * kept, b: color.b * kept };
}

/**
 * `Color::lightened` (`core/math/color.h:127-133`): each colour channel moves toward white by `amount`.
 * Double, not float, as the callers' colours are.
 *
 * @canonical A darker or lighter colour
 */
export function lightened<C extends ColorChannels>(color: C, amount: number): C {
  const { r, g, b } = color;
  return { ...color, r: r + (1 - r) * amount, g: g + (1 - g) * amount, b: b + (1 - b) * amount };
}
