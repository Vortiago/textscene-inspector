/**
 * Godot-parity contract for what a LineEdit paints, from `LineEdit::_shape()`
 * (scene/gui/line_edit.cpp):
 *
 *     String t;
 *     if (text.is_empty() && ime_text.is_empty()) {
 *       t = placeholder_translated;
 *     } else if (pass) {
 *       String s = secret_character.is_empty() ? U"•" : secret_character.left(1);
 *       t = s.repeat(text.length() + ime_text.length());
 *     } else {
 *       t = text;
 *     }
 *
 * The distinguishing case is the BRANCH ORDER: the empty-text test runs before
 * the `pass` (secret) test, so a secret field with no text shows its
 * placeholder in the clear rather than a row of bullets. An implementation that
 * checked `secret` first would print nothing there and look plausible.
 *
 * Measured: real Godot 4.6 draws "Enter text here..." on the LineEdit in
 * `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn`, which sets only
 * `placeholder_text` and no `text`.
 */
import { describe, it, expect } from 'vitest';
import { lineEditDisplayText, DEFAULT_SECRET_CHARACTER } from './displayText';

describe('lineEditDisplayText', () => {
  it('paints `text` when there is some (happy path)', () => {
    expect(lineEditDisplayText({ name: 'L', text: 'hello' })).toEqual({
      text: 'hello',
      isPlaceholder: false,
    });
  });

  it('falls back to the placeholder when text is empty — the acceptance scene case', () => {
    expect(lineEditDisplayText({ name: 'L', placeholderText: 'Enter text here...' })).toEqual({
      text: 'Enter text here...',
      isPlaceholder: true,
    });
  });

  it('echoes bullets for a secret field that HAS text', () => {
    expect(lineEditDisplayText({ name: 'L', text: 'hunter2', secret: true })).toEqual({
      text: DEFAULT_SECRET_CHARACTER.repeat(7),
      isPlaceholder: false,
    });
  });

  it('shows the placeholder, not bullets, for a secret field with no text', () => {
    // The empty-text branch precedes the `pass` branch in _shape().
    expect(lineEditDisplayText({ name: 'L', secret: true, placeholderText: 'Password' })).toEqual({
      text: 'Password',
      isPlaceholder: true,
    });
  });

  it('uses only the FIRST character of secret_character', () => {
    expect(lineEditDisplayText({ name: 'L', text: 'abc', secret: true, secretCharacter: '*#' }).text).toBe(
      '***'
    );
  });

  it('falls back to the bullet when secret_character is empty (error path)', () => {
    expect(lineEditDisplayText({ name: 'L', text: 'ab', secret: true, secretCharacter: '' }).text).toBe(
      DEFAULT_SECRET_CHARACTER.repeat(2)
    );
  });

  it('counts code points, not UTF-16 units, so an emoji echoes once (edge case)', () => {
    // Godot's String::length() is UTF-32; '🎉' is one character there.
    expect(lineEditDisplayText({ name: 'L', text: '🎉', secret: true }).text).toBe(
      DEFAULT_SECRET_CHARACTER
    );
  });

  it('paints an empty placeholder for a wholly bare LineEdit (edge case)', () => {
    expect(lineEditDisplayText({ name: 'L' })).toEqual({ text: '', isPlaceholder: true });
  });
});
