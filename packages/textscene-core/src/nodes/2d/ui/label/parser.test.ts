import { describe, expect, it } from 'vitest';
import { parseLabel } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseLabel', () => {
  it('unquotes text and parses alignment/autowrap/uppercase together', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), {
      text: '"Hello World"',
      horizontal_alignment: '1',
      vertical_alignment: '2',
      autowrap_mode: '3',
      uppercase: 'true',
    });
    expect(p.text).toBe('Hello World');
    expect(p.horizontalAlignment).toBe(1);
    expect(p.verticalAlignment).toBe(2);
    expect(p.autowrapMode).toBe(3);
    expect(p.uppercase).toBe(true);
  });

  it('leaves alignment/autowrap undefined for malformed (non-numeric) values', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), {
      horizontal_alignment: 'garbage',
      autowrap_mode: 'nope',
    });
    expect(p.horizontalAlignment).toBeUndefined();
    expect(p.autowrapMode).toBeUndefined();
  });

  it('leaves text/alignment/uppercase undefined when properties are absent', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), {});
    expect(p.text).toBeUndefined();
    expect(p.horizontalAlignment).toBeUndefined();
    expect(p.verticalAlignment).toBeUndefined();
    expect(p.autowrapMode).toBeUndefined();
    expect(p.uppercase).toBeUndefined();
  });

  it('only "true" (exact match) sets uppercase — any other value stays undefined', () => {
    const notTrue = parseLabel(heading('Label', { name: 'T' }), { uppercase: 'false' });
    expect(notTrue.uppercase).toBeUndefined();
    const wrongCase = parseLabel(heading('Label', { name: 'T' }), { uppercase: 'TRUE' });
    expect(wrongCase.uppercase).toBeUndefined();
  });

  it('unquotes an empty text literal to an empty string (edge)', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { text: '""' });
    expect(p.text).toBe('');
  });

  it("defaults vertical size flags to Godot's Label SHRINK_CENTER (4) when unset", () => {
    // Godot's `Label` constructor overrides Control's SIZE_FILL default, so a
    // Label centres on a box container's cross axis instead of filling it.
    expect(parseLabel(heading('Label', { name: 'T' }), {}).sizeFlagsVertical).toBe(4);
  });

  it('keeps an explicit size_flags_vertical from the scene', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { size_flags_vertical: '1' });
    expect(p.sizeFlagsVertical).toBe(1);
  });
});
