/**
 * Which strings a COLOR slot converts: `Color(const String &)` reads HTML hex
 * (`color.cpp:372-394`) or a name `find_named_color` finds (`color.cpp:412-432`).
 */

import { describe, expect, it } from 'vitest';
import { NAMED_COLOR_COUNT, isColorString } from './color.js';

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

  it.each(['', '#', 'ff00f', 'ff00000', 'gg0000', 'not a color', 'reddish'])('refuses %j, which named() fails on', (text) => {
    expect(isColorString(text)).toBe(false);
  });

  it('holds every name in color_names.inc', () => {
    expect(NAMED_COLOR_COUNT).toBe(146);
  });
});
