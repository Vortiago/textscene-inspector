/**
 * Which strings a COLOR slot converts: `Color(const String &)` reads HTML hex
 * (`color.cpp:372-394`) or a name `find_named_color` finds (`color.cpp:412-432`). Every named
 * colour expectation is `color_names.inc`'s own `Color::hex(0xRRGGBBAA)` literal, cited by line.
 * Then `Color::darkened` and `Color::lightened`, on worked examples.
 */

import { describe, expect, it } from 'vitest';
import {
  colorHue,
  colorSaturation,
  darkened,
  hsvToRgb,
  isColorString,
  lightened,
  namedColor,
} from './color.js';

describe('isColorString', () => {
  it.each(['ff0000', '#ff0000', 'F00', '#f00a', 'ff000080', '#FF000080'])('reads the HTML hex %s', (text) => {
    expect(isColorString(text)).toBe(true);
  });

  it.each(['red', 'RED', 'alice_blue', 'Alice Blue', 'alice-blue', "alice'blue.", 'yellowgreen'])(
    'finds the named colour %s after normalising it',
    (text) => {
      expect(isColorString(text)).toBe(true);
    }
  );

  it.each(['', '#', 'ff00f', 'ff00000', 'gg0000', 'not a color', 'reddish'])(
    'refuses %j, which named() fails on',
    (text) => {
      expect(isColorString(text)).toBe(false);
    }
  );
});

describe('namedColor', () => {
  it.each([
    // color_names.inc:50, the first entry.
    ['ALICE_BLUE', { r: 0xf0 / 255, g: 0xf8 / 255, b: 1, a: 1 }],
    // :100: GRAY is X11's 0xBEBEBE, not the web 0x808080 that WEB_GRAY carries at :187.
    ['GRAY', { r: 0xbe / 255, g: 0xbe / 255, b: 0xbe / 255, a: 1 }],
    ['WEB_GRAY', { r: 0x80 / 255, g: 0x80 / 255, b: 0x80 / 255, a: 1 }],
    // :163, a CSS name X11 lacks.
    ['REBECCA_PURPLE', { r: 0x66 / 255, g: 0x33 / 255, b: 0x99 / 255, a: 1 }],
    // :164.
    ['RED', { r: 1, g: 0, b: 0, a: 1 }],
    // :195, the last entry.
    ['YELLOW_GREEN', { r: 0x9a / 255, g: 0xcd / 255, b: 0x32 / 255, a: 1 }],
  ])('resolves %s to its color_names.inc entry', (name, rgba) => {
    expect(namedColor(name)).toEqual(rgba);
  });

  it('carries an entry whose alpha is not 1', () => {
    // :184: TRANSPARENT is white at alpha 0, so a table of RGB alone reads it as opaque white.
    expect(namedColor('transparent')).toEqual({ r: 1, g: 1, b: 1, a: 0 });
  });

  it('normalises away spaces, dashes, underscores, apostrophes and dots before matching', () => {
    // `find_named_color` (`color.cpp:414-415`): `remove_chars(" -_'.")` then `to_upper()`.
    const darkOrange = { r: 1, g: 0x8c / 255, b: 0, a: 1 }; // :79
    for (const spelling of ['dark_orange', 'DarkOrange', 'DARK ORANGE', 'dark-orange', 'd.a.r.k.orange']) {
      expect(namedColor(spelling)).toEqual(darkOrange);
    }
  });

  it('returns nothing for a name the table does not carry, so the caller applies its own fallback', () => {
    // `Color::named(name, default)` returns `p_default` on a miss (`color.cpp:404-410`), and
    // `from_string`'s default differs per call site.
    expect(namedColor('nosuchcolour')).toBeUndefined();
    expect(namedColor('')).toBeUndefined();
    // `Color::from_string` tries `html` first, so the table must not match a hex string.
    expect(namedColor('#ff0000')).toBeUndefined();
  });
});

describe('darkened', () => {
  it('shrinks each colour channel by the amount and keeps alpha', () => {
    expect(darkened({ r: 0.8, g: 0.4, b: 0, a: 0.5 }, 0.5)).toEqual({ r: 0.4, g: 0.2, b: 0, a: 0.5 });
  });
});

describe('lightened', () => {
  it('moves each colour channel toward white by the amount and keeps alpha', () => {
    expect(lightened({ r: 0, g: 0.5, b: 1, a: 0.25 }, 0.5)).toEqual({ r: 0.5, g: 0.75, b: 1, a: 0.25 });
  });
});

describe('hsvToRgb', () => {
  // core/math/color.cpp:182-227 (Color::set_hsv), case i:0 h in [0,1/6).
  it('is pure red at h=0, s=1, v=1', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('is achromatic grey at s=0, independent of h', () => {
    expect(hsvToRgb(0.42, 0, 0.5)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });

  it('wraps h past 1 the same as Math::fmod on a negative-safe range', () => {
    expect(hsvToRgb(1, 1, 1)).toEqual(hsvToRgb(0, 1, 1));
  });
});

describe('colorHue', () => {
  it.each([
    ['red', { r: 1, g: 0, b: 0 }, 0],
    ['green', { r: 0, g: 1, b: 0 }, 1 / 3],
    ['blue', { r: 0, g: 0, b: 1 }, 2 / 3],
    // r is the maximum and b exceeds g, so (g - b) / delta is negative and wraps (color.cpp:156-158).
    ['a magenta-leaning red', { r: 1, g: 0, b: 0.5 }, 11 / 12],
    ['a grey, which has no hue', { r: 0.4, g: 0.4, b: 0.4 }, 0],
  ])('reads the hue of %s', (_name, color, hue) => {
    expect(colorHue(color)).toBeCloseTo(hue, 10);
  });
});

describe('colorSaturation', () => {
  it('is the span of the channels over the brightest', () => {
    expect(colorSaturation({ r: 0.5, g: 0.25, b: 0.25 })).toBe(0.5);
  });

  it('is 0 for black, which has no brightest channel to divide by', () => {
    expect(colorSaturation({ r: 0, g: 0, b: 0 })).toBe(0);
  });
});
