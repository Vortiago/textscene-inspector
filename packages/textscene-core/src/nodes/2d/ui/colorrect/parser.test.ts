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

  it('leaves color undefined for an empty/falsy value (malformed)', () => {
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), { color: '' });
    expect(p.color).toBeUndefined();
  });

  it('leaves color undefined when the property is absent entirely', () => {
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), {});
    expect(p.color).toBeUndefined();
  });

  it('passes a non-Color-syntax string through raw (parser does not validate syntax)', () => {
    // ColorRect keeps `color` as a raw string — Component.tsx's colorToCss
    // is the consumer that would degrade a bad value, not the parser. This
    // pins the CURRENT lenient pass-through, not a validation contract.
    const p = parseColorRect(heading('ColorRect', { name: 'Bg' }), { color: 'not-a-color' });
    expect(p.color).toBe('not-a-color');
  });
});
