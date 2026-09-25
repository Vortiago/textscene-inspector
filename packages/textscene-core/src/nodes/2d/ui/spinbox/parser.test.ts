/** SpinBox parser contract: Control and Range bases plus SpinBox's own properties. */
import { describe, it, expect } from 'vitest';
import { parseSpinBox } from './parser';

const heading = { type: 'node', attributes: { type: 'SpinBox', name: 'Weight' } };

describe('parseSpinBox', () => {
  it('parses the Control, Range and SpinBox properties (happy path)', () => {
    const result = parseSpinBox(heading, {
      layout_mode: '2',
      min_value: '0.0',
      max_value: '20.0',
      step: '0.25',
      value: '5.4',
      alignment: '2',
      editable: 'true',
      update_on_text_changed: 'true',
      prefix: '"$"',
      suffix: '"kg"',
      custom_arrow_step: '0.5',
      custom_arrow_round: 'true',
      select_all_on_focus: 'true',
    });
    expect(result.name).toBe('Weight');
    expect(result.layoutMode).toBe(2);
    expect(result.minValue).toBe(0);
    expect(result.maxValue).toBe(20);
    expect(result.step).toBe(0.25);
    expect(result.value).toBe(5.4);
    expect(result.alignment).toBe(2);
    expect(result.editable).toBe(true);
    expect(result.updateOnTextChanged).toBe(true);
    expect(result.prefix).toBe('$');
    expect(result.suffix).toBe('kg');
    expect(result.customArrowStep).toBe(0.5);
    expect(result.customArrowRound).toBe(true);
    expect(result.selectAllOnFocus).toBe(true);
  });

  it('distinguishes an explicitly empty prefix from an absent one (error path)', () => {
    const result = parseSpinBox(heading, { prefix: '""' });
    expect(result.prefix).toBe('');
    expect(result.suffix).toBeUndefined();
  });

  it('leaves a malformed alignment undefined rather than defaulting (error path)', () => {
    expect(parseSpinBox(heading, { alignment: 'middle' }).alignment).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseSpinBox({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.editable).toBeUndefined();
    expect(result.prefix).toBeUndefined();
    // Not undefined: SpinBox's constructor sets `step = 1.0`, and
    // `Range::_calc_value` snaps `value` to it whether or not the scene says so.
    expect(result.step).toBe(1);
  });
});
