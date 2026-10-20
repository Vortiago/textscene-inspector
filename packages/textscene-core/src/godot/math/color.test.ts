/**
 * Which strings a COLOR slot converts: `Color(const String &)` reads HTML hex
 * (`color.cpp:372-394`) or a name `find_named_color` finds (`color.cpp:412-432`). Every named
 * colour expectation is `color_names.inc`'s own `Color::hex(0xRRGGBBAA)` literal, cited by line.
 */

import { describe, expect, it } from 'vitest';
import { isColorString, namedColor } from './color.js';

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
