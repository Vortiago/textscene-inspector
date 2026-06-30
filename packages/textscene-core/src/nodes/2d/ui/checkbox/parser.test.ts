import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseCheckBox } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCheckBox', () => {
  it('unquotes the label text and reads the checked + disabled flags', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {
      text: '"Enable Sound"',
      button_pressed: 'true',
      disabled: 'true',
    });
    expect(p.text).toBe('Enable Sound');
    expect(p.buttonPressed).toBe(true);
    expect(p.disabled).toBe(true);
  });

  it('defaults checked + disabled to false and leaves text undefined when absent', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {});
    expect(p.buttonPressed).toBe(false);
    expect(p.disabled).toBe(false);
    expect(p.text).toBeUndefined();
  });
});
