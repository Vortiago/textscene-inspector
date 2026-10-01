/**
 * Godot's X11 named-colour table, `core/math/color_names.inc` transcribed verbatim, and the
 * `Color::find_named_color` lookup over it (`core/math/color.cpp:412-431`). `Color::from_string`
 * (`color.cpp:450-456`) consults it for a string that is not valid hex, as `[color=red]` does.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Color } from './colorParser';

/**
 * The raw table: normalised name → `0xRRGGBBAA`. Keys drop underscores, as `find_named_color`
 * builds its hash map (`color.cpp:422`), and a query normalises the same way. Values are the
 * source's own literals, to diff by eye.
 */
export const GODOT_NAMED_COLORS: Readonly<Record<string, number>> = {
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

/**
 * `find_named_color`'s own normalization (`color.cpp:414-415`): strip spaces,
 * dashes, underscores, apostrophes and dots, then upper-case. `CamelCase`,
 * `snake_case` and `SPACE SEPARATED` spellings all collapse to one key.
 */
function normalizeColorName(name: string): string {
  return name.replace(/[ \-_'.]/g, '').toUpperCase();
}

/**
 * `Color::named` (`color.cpp:404-410`) without its fallback argument: returns
 * `undefined` on a miss so each caller applies the default its own
 * `Color::from_string` call site passes.
 */
export function godotNamedColor(name: string): Color | undefined {
  const packed = GODOT_NAMED_COLORS[normalizeColorName(name)];
  if (packed === undefined) return undefined;
  return {
    r: ((packed >>> 24) & 0xff) / 255,
    g: ((packed >>> 16) & 0xff) / 255,
    b: ((packed >>> 8) & 0xff) / 255,
    a: (packed & 0xff) / 255,
  };
}
