import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton, isButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseButton', () => {
  it('unquotes text + parses flags + alignment + font-size override', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), {
      text: '"Click Me"',
      disabled: 'true',
      flat: 'true',
      alignment: '1',
      'theme_override_font_sizes/font_size': '18',
    });
    expect(p.text).toBe('Click Me');
    expect(p.disabled).toBe(true);
    expect(p.flat).toBe(true);
    expect(p.alignment).toBe(1);
    expect(p.themeOverrideFontSizes?.font_size).toBe(18);
  });

  it('defaults flags to false and leaves alignment undefined when absent', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), {
      'theme_override_styles/normal': 'SubResource("StyleBoxFlat_1")',
    });
    expect(p.text).toBeUndefined();
    expect(p.disabled).toBe(false);
    expect(p.flat).toBe(false);
    expect(p.alignment).toBeUndefined();
    expect(p.themeOverrideStyles?.normal).toBe('SubResource("StyleBoxFlat_1")');
  });

  it('type guard accepts/rejects', () => {
    expect(isButton(h({ type: 'Button' }))).toBe(true);
    expect(isButton(h({ type: 'Label' }))).toBe(false);
  });
});
