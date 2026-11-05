/** The lines of a TextMesh in its own direction, language and structured override (`primitive_meshes.cpp:3224-3240`). */

import { describe, expect, it } from 'vitest';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { decodeTextMesh } from './decode';
import { shapeTextMeshLines } from './textMeshLines';

/** The first line's glyph characters, left to right, of a TextMesh with `raw` properties. */
function visual(raw: Record<string, string>, locale = ''): string {
  return shapeTextMeshLines(decodeTextMesh(raw), locale, OPEN_SANS_FONT_METRICS)
    .lines[0]!.glyphs.map((glyph) => glyph.char)
    .join('');
}

describe('shapeTextMeshLines', () => {
  it('shapes an RTL paragraph with `!` at the visual left', () => {
    expect(visual({ text: '"Hello!"', text_direction: '2' })).toBe('!Hello');
  });

  it('takes a neutral paragraph from the language, else from the locale', () => {
    expect(visual({ text: '"123!"', language: '"he"' })).toBe('!123');
    expect(visual({ text: '"123!"' }, 'he')).toBe('!123');
  });

  it('upper-cases in the case map of the language, else of the locale', () => {
    expect(visual({ text: '"istanbul"', uppercase: 'true', language: '"tr"' })).toBe('İSTANBUL');
    expect(visual({ text: '"istanbul"', uppercase: 'true' }, 'tr')).toBe('İSTANBUL');
  });
});
