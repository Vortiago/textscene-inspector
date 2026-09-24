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

  it('parses text_overrun_behavior and clip_text', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { text_overrun_behavior: '3', clip_text: 'true' });
    expect(p.overrunBehavior).toBe(3);
    expect(p.clipText).toBe(true);
  });

  it('reads ellipsis_char through the StringName jacket, keeping only its first character (label.cpp:1259-1261)', () => {
    const jacketed = parseLabel(heading('Label', { name: 'T' }), { ellipsis_char: '&"ab"' });
    expect(jacketed.ellipsisChar).toBe('a');
    const bare = parseLabel(heading('Label', { name: 'T' }), { ellipsis_char: '"*"' });
    expect(bare.ellipsisChar).toBe('*');
  });

  it('an empty ellipsis_char literal leaves ellipsisChar undefined (falls back to the engine default)', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { ellipsis_char: '""' });
    expect(p.ellipsisChar).toBeUndefined();
  });

  it('parses justification_flags as a raw bitmask int', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { justification_flags: '130' });
    expect(p.justificationFlags).toBe(130);
  });

  it('parses tab_stops as a flat PackedFloat32Array literal', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { tab_stops: 'PackedFloat32Array(10, 20, 30)' });
    expect(p.tabStopsPx).toEqual([10, 20, 30]);
  });

  it('leaves tabStopsPx undefined for a malformed tab_stops literal (lenient)', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { tab_stops: 'garbage' });
    expect(p.tabStopsPx).toBeUndefined();
  });

  it('parses autowrap_trim_flags as a raw bitmask int', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), { autowrap_trim_flags: '192' });
    expect(p.autowrapTrimFlags).toBe(192);
  });

  it('parses paragraph_separator, lines_skipped, max_lines_visible and label_settings', () => {
    const p = parseLabel(heading('Label', { name: 'T' }), {
      paragraph_separator: '"|"',
      lines_skipped: '2',
      max_lines_visible: '3',
      label_settings: 'SubResource("LabelSettings_1")',
    });
    expect(p.paragraphSeparator).toBe('|');
    expect(p.linesSkipped).toBe(2);
    expect(p.maxLinesVisible).toBe(3);
    expect(p.labelSettings).toBe('SubResource("LabelSettings_1")');
  });

  describe('visible_characters / visible_ratio cross-derivation (label.cpp:1285-1327)', () => {
    it('visible_characters alone derives visible_ratio from the text length (happy path)', () => {
      const p = parseLabel(heading('Label', { name: 'T' }), { text: '"Hello"', visible_characters: '2' });
      expect(p.visibleCharacters).toBe(2);
      expect(p.visibleRatio).toBe(0.4);
    });

    it('visible_characters = -1 is "show all", ratio 1.0 regardless of length', () => {
      const p = parseLabel(heading('Label', { name: 'T' }), { text: '"Hello"', visible_characters: '-1' });
      expect(p.visibleCharacters).toBe(-1);
      expect(p.visibleRatio).toBe(1);
    });

    it('visible_ratio alone clamps at 1.0 and resets visible_characters to -1', () => {
      // Measured on 4.6.3 (linterParser.ts): visible_ratio = 3.0 alone clamps to 1.0.
      const p = parseLabel(heading('Label', { name: 'T' }), { text: '"0"', visible_ratio: '3.0' });
      expect(p.visibleRatio).toBe(1);
      expect(p.visibleCharacters).toBe(-1);
    });

    it('visible_characters THEN visible_ratio in file order: the later setter is a no-op once it matches the already-derived ratio, leaving the OVER-1 value unclamped', () => {
      // Measured on 4.6.3: text = "0", visible_characters = 3, then visible_ratio = 3.0 stores 3.0
      // unclamped. `set_visible_ratio` runs only when `visible_ratio != p_ratio` (label.cpp:1306), and
      // visible_characters already left visible_ratio at 3.0.
      const p = parseLabel(heading('Label', { name: 'T' }), {
        text: '"0"',
        visible_characters: '3',
        visible_ratio: '3.0',
      });
      expect(p.visibleCharacters).toBe(3);
      expect(p.visibleRatio).toBe(3);
    });

    it('visible_ratio THEN visible_characters in file order: the later setter wins outright', () => {
      const p = parseLabel(heading('Label', { name: 'T' }), {
        text: '"Hello"',
        visible_ratio: '1.0',
        visible_characters: '2',
      });
      expect(p.visibleCharacters).toBe(2);
      expect(p.visibleRatio).toBe(0.4);
    });

    it('neither authored leaves the class defaults (edge case)', () => {
      const p = parseLabel(heading('Label', { name: 'T' }), { text: '"Hello"' });
      expect(p.visibleCharacters).toBeUndefined();
      expect(p.visibleRatio).toBeUndefined();
    });
  });
});
