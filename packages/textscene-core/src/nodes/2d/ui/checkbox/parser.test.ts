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

describe('parseCheckBox — clip_text', () => {
  it('reads clip_text', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), { text: '"Sound"', clip_text: 'true' });
    expect(p.clipText).toBe(true);
  });

  it('leaves clipText undefined when absent', () => {
    expect(parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {}).clipText).toBeUndefined();
  });
});

describe('parseCheckBox — alignment', () => {
  it('reads alignment, which Button declares and CheckBox inherits', () => {
    expect(parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), { alignment: '2' }).alignment).toBe(2);
  });

  it('leaves alignment undefined when absent', () => {
    expect(parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {}).alignment).toBeUndefined();
  });
});

describe('parseCheckBox — text_overrun_behavior', () => {
  it('reads text_overrun_behavior', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), { text_overrun_behavior: '3' });
    expect(p.overrunBehavior).toBe(3);
  });

  it('leaves overrunBehavior undefined when absent', () => {
    expect(parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {}).overrunBehavior).toBeUndefined();
  });
});

describe('parseCheckBox — autowrap_mode and autowrap_trim_flags', () => {
  it('reads both', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {
      autowrap_mode: '2',
      autowrap_trim_flags: '0',
    });
    expect(p.autowrapMode).toBe(2);
    expect(p.autowrapTrimFlags).toBe(0);
  });

  it('leaves both undefined when absent', () => {
    const p = parseCheckBox(h({ name: 'Sound', type: 'CheckBox' }), {});
    expect(p.autowrapMode).toBeUndefined();
    expect(p.autowrapTrimFlags).toBeUndefined();
  });
});

describe('parseCheckBox button_pressed', () => {
  const parse = (properties: Record<string, string>) =>
    parseCheckBox(h({ name: 'X', type: 'CheckBox' }), properties).buttonPressed;

  it('is on without toggle_mode, which the constructor sets', () => {
    expect(parse({ button_pressed: 'true' })).toBe(true);
  });

  it('is off once toggle_mode is false, as BaseButton::set_pressed refuses it', () => {
    expect(parse({ toggle_mode: 'false', button_pressed: 'true' })).toBe(false);
  });
});
