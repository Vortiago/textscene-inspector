import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseMenuButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseMenuButton', () => {
  it('defaults flat to true when the key is absent (menu_button.cpp:264 constructor default)', () => {
    const p = parseMenuButton(h({ name: 'M', type: 'MenuButton' }), { text: '"File"' });
    expect(p.flat).toBe(true);
    expect(p.text).toBe('File');
  });

  it('honours an explicit flat=false override', () => {
    const p = parseMenuButton(h({ name: 'M', type: 'MenuButton' }), { flat: 'false' });
    expect(p.flat).toBe(false);
  });

  it('honours an explicit flat=true, same result as the default', () => {
    const p = parseMenuButton(h({ name: 'M', type: 'MenuButton' }), { flat: 'true' });
    expect(p.flat).toBe(true);
  });
});
