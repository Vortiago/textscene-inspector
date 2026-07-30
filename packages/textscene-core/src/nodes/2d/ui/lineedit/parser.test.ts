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
