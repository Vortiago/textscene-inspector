import { describe, expect, it } from 'vitest';
import { parseColorRect } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseColorRect', () => {
  it('maps color and base Control layout props together', () => {
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), {
      color: 'Color(0.2, 0.4, 0.6, 1)',
      anchors_preset: '15',
      anchor_right: '1.0',
      anchor_bottom: '1.0',
      size_flags_horizontal: '3',
    });
    expect(p.color).toBe('Color(0.2, 0.4, 0.6, 1)');
    expect(p.anchorsPreset).toBe(15);
    expect(p.anchorRight).toBe(1);
    expect(p.anchorBottom).toBe(1);
    expect(p.sizeFlagsHorizontal).toBe(3);
  });

  it('falls back to the Godot default for an empty/falsy value (malformed)', () => {
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), { color: '' });
    expect(p.color).toBe('Color(1, 1, 1, 1)');
  });

  it('defaults to Godot opaque white when the property is absent entirely', () => {
    // Godot omits a property at its default, so an absent `color` means
    // Color(1, 1, 1, 1), not "no fill".
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), {});
    expect(p.color).toBe('Color(1, 1, 1, 1)');
  });

  it('passes a non-Color-syntax string through raw (parser does not validate syntax)', () => {
    // The parser keeps `color` as a raw string, and the painter's colour parse
    // handles a bad value. This pins the lenient pass-through, not a validation contract.
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), { color: 'not-a-color' });
    expect(p.color).toBe('not-a-color');
  });
});
