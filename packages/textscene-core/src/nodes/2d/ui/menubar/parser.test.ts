import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseMenuBar } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseMenuBar', () => {
  it('parses flat true and inherited Control properties', () => {
    const p = parseMenuBar(h({ name: 'Bar', type: 'MenuBar' }), {
      flat: 'true',
      'theme_override_colors/font_color': 'Color(1, 0, 0, 1)',
    });
    expect(p.flat).toBe(true);
    expect(p.themeOverrideColors?.font_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('defaults flat to false when absent', () => {
    const p = parseMenuBar(h({ name: 'Bar', type: 'MenuBar' }), {});
    expect(p.flat).toBe(false);
  });

  it('treats a malformed flat value as false, per boolSlotValue', () => {
    const p = parseMenuBar(h({ name: 'Bar', type: 'MenuBar' }), { flat: 'maybe' });
    expect(p.flat).toBe(false);
  });
});
