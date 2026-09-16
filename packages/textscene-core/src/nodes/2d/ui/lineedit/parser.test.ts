/** LineEdit parser contract — Control base plus the text/placeholder/echo properties. */
import { describe, it, expect } from 'vitest';
import { parseLineEdit } from './parser';

const heading = { type: 'node', attributes: { type: 'LineEdit', name: 'NameField' } };

describe('parseLineEdit', () => {
  it('parses the Control base and LineEdit properties (happy path)', () => {
    const result = parseLineEdit(heading, {
      layout_mode: '2',
      text: '"Ada"',
      placeholder_text: '"Enter text here..."',
      alignment: '1',
      editable: 'false',
      secret: 'true',
      secret_character: '"*"',
      flat: 'true',
    });
    expect(result.name).toBe('NameField');
    expect(result.layoutMode).toBe(2);
    expect(result.text).toBe('Ada');
    expect(result.placeholderText).toBe('Enter text here...');
    expect(result.alignment).toBe(1);
    expect(result.editable).toBe(false);
    expect(result.secret).toBe(true);
    expect(result.secretCharacter).toBe('*');
    expect(result.flat).toBe(true);
  });

  it('parses the icon/clear-button/max-length/caret properties (happy path)', () => {
    const result = parseLineEdit(heading, {
      max_length: '10',
      expand_to_text_length: 'true',
      clear_button_enabled: 'true',
      right_icon: 'ExtResource("1_icon")',
      icon_expand_mode: '2',
      right_icon_scale: '0.5',
      caret_force_displayed: 'true',
      draw_control_chars: 'true',
    });
    expect(result.maxLength).toBe(10);
    expect(result.expandToTextLength).toBe(true);
    expect(result.clearButtonEnabled).toBe(true);
    expect(result.rightIcon).toBe('ExtResource("1_icon")');
    expect(result.iconExpandMode).toBe(2);
    expect(result.rightIconScale).toBe(0.5);
    expect(result.caretForceDisplayed).toBe(true);
    expect(result.drawControlChars).toBe(true);
  });

  it('leaves the icon/clear-button/max-length/caret properties undefined when absent (edge case)', () => {
    const result = parseLineEdit(heading, {});
    expect(result.maxLength).toBeUndefined();
    expect(result.expandToTextLength).toBeUndefined();
    expect(result.clearButtonEnabled).toBeUndefined();
    expect(result.rightIcon).toBeUndefined();
    expect(result.iconExpandMode).toBeUndefined();
    expect(result.rightIconScale).toBeUndefined();
    expect(result.caretForceDisplayed).toBeUndefined();
    expect(result.drawControlChars).toBeUndefined();
  });

  it('distinguishes an explicitly empty string from an absent one (error path)', () => {
    // "" is authored intent — it must not read as "property not set", which is
    // what decides whether the placeholder or the text branch wins.
    const result = parseLineEdit(heading, { text: '""' });
    expect(result.text).toBe('');
    expect(result.placeholderText).toBeUndefined();
  });

  it('leaves a malformed alignment undefined rather than defaulting to CENTER (error path)', () => {
    expect(parseLineEdit(heading, { alignment: 'middle' }).alignment).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseLineEdit({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.text).toBeUndefined();
    expect(result.editable).toBeUndefined();
    expect(result.secret).toBeUndefined();
  });
});
