/**
 * `Color::named` and `Color::find_named_color` (`core/math/color.cpp:396-431`) over the X11 table
 * in `core/math/color_names.inc`. Every expectation is the table's own `Color::hex(0xRRGGBBAA)`
 * literal, never a rendered pixel.
 */
import { describe, expect, it } from 'vitest';
import { godotNamedColor, GODOT_NAMED_COLORS } from './godotNamedColor';

describe('godotNamedColor', () => {
  it('resolves a plain X11 name to its own table entry', () => {
    // color_names.inc:164: { "RED", Color::hex(0xFF0000FF) }.
    expect(godotNamedColor('red')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    // :100: GRAY is X11's 0xBEBEBE, not the web 0x808080 that WEB_GRAY carries.
    expect(godotNamedColor('gray')).toEqual({ r: 0xbe / 255, g: 0xbe / 255, b: 0xbe / 255, a: 1 });
    expect(godotNamedColor('web_gray')).toEqual({ r: 0x80 / 255, g: 0x80 / 255, b: 0x80 / 255, a: 1 });
  });

  it('carries an entry whose alpha is not 1', () => {
    // :184: TRANSPARENT is white at alpha 0, so a table of RGB alone reads it as opaque white.
    expect(godotNamedColor('transparent')).toEqual({ r: 1, g: 1, b: 1, a: 0 });
  });

  it('normalizes away spaces, dashes, underscores, apostrophes and dots before matching', () => {
    // `find_named_color` (`color.cpp:414-415`): `remove_chars(" -_'.")` then
    // `to_upper()`, against keys that are the table names with `_` removed.
    const expected = { r: 1, g: 0x8c / 255, b: 0, a: 1 }; // :79 DARK_ORANGE
    for (const spelling of ['dark_orange', 'DarkOrange', 'DARK ORANGE', 'dark-orange', 'd.a.r.k.orange']) {
      expect(godotNamedColor(spelling)).toEqual(expected);
    }
  });

  it('returns undefined for a name the table does not carry, so the caller can apply its own fallback', () => {
    // `Color::named(name, default)` returns `p_default` on a miss
    // (`color.cpp:404-410`). This reports the miss instead, since `from_string`'s default differs
    // per call site.
    expect(godotNamedColor('nosuchcolour')).toBeUndefined();
    expect(godotNamedColor('')).toBeUndefined();
    // A hex string is not a name: `Color::from_string` tries `html` first, so the table must not
    // match one.
    expect(godotNamedColor('#ff0000')).toBeUndefined();
  });

  it('carries the whole table, not a convenient subset', () => {
    // `get_named_color_count()` is 146 in 4.6.3. A partial port looks correct for `red` and falls
    // back for the rest.
    expect(Object.keys(GODOT_NAMED_COLORS)).toHaveLength(146);
  });
});
