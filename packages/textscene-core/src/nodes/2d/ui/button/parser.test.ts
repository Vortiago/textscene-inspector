import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton } from './parser';

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

  it('parses text_overrun_behavior and clip_text', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), {
      text_overrun_behavior: '3',
      clip_text: 'true',
    });
    expect(p.overrunBehavior).toBe(3);
    expect(p.clipText).toBe(true);
  });

  it('defaults text_direction to AUTO and language to empty (button.h)', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), {});
    expect(p.textDirection).toBe(0);
    expect(p.language).toBe('');
  });

  it('reads text_direction and language', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), { text_direction: '2', language: '"he"' });
    expect(p.textDirection).toBe(2);
    expect(p.language).toBe('he');
  });

  it('keeps AUTO for a text_direction the setter refuses (button.cpp:637)', () => {
    const p = parseButton(h({ name: 'Ok', type: 'Button' }), { text_direction: '7' });
    expect(p.textDirection).toBe(0);
  });
});

describe('parseButton button_pressed', () => {
  const parse = (properties: Record<string, string>) =>
    parseButton(h({ name: 'B', type: 'Button' }), properties).buttonPressed;

  it('is on for a toggle whose button_pressed is true', () => {
    expect(parse({ toggle_mode: 'true', button_pressed: 'true' })).toBe(true);
  });

  it('is off for a button that is no toggle, as BaseButton::set_pressed refuses it', () => {
    expect(parse({ button_pressed: 'true' })).toBe(false);
  });

  it('is off when absent', () => {
    expect(parse({})).toBe(false);
  });
});
