/**
 * Tests what a LineEdit paints against `LineEdit::_shape()` (scene/gui/line_edit.cpp), whose empty-text
 * branch runs before the `pass` branch: a secret field with no text shows its placeholder, not bullets.
 * Godot 4.6 draws "Enter text here..." on the LineEdit in
 * `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn`, which sets only `placeholder_text`.
 */
import { describe, it, expect } from 'vitest';
import { lineEditDisplayText } from './displayText';

// line_edit.h:118 defaults secret_character to U"•".
const BULLET = '•';

describe('lineEditDisplayText', () => {
  it('paints `text` when there is some (happy path)', () => {
    expect(lineEditDisplayText({ text: 'hello' })).toEqual({
      text: 'hello',
      isPlaceholder: false,
    });
  });

  it('falls back to the placeholder when text is empty — the acceptance scene case', () => {
    expect(lineEditDisplayText({ placeholderText: 'Enter text here...' })).toEqual({
      text: 'Enter text here...',
      isPlaceholder: true,
    });
  });

  it('echoes bullets for a secret field that HAS text', () => {
    expect(lineEditDisplayText({ text: 'hunter2', secret: true })).toEqual({
      text: BULLET.repeat(7),
      isPlaceholder: false,
    });
  });

  it('shows the placeholder, not bullets, for a secret field with no text', () => {
    // The empty-text branch precedes the `pass` branch in _shape().
    expect(lineEditDisplayText({ secret: true, placeholderText: 'Password' })).toEqual({
      text: 'Password',
      isPlaceholder: true,
    });
  });

  it('uses only the FIRST character of secret_character', () => {
    expect(lineEditDisplayText({ text: 'abc', secret: true, secretCharacter: '*#' }).text).toBe('***');
  });

  it('falls back to the bullet when secret_character is empty (error path)', () => {
    expect(lineEditDisplayText({ text: 'ab', secret: true, secretCharacter: '' }).text).toBe(
      BULLET.repeat(2)
    );
  });

  it('counts code points, not UTF-16 units, so an emoji echoes once (edge case)', () => {
    // Godot's String::length() is UTF-32; '🎉' is one character there.
    expect(lineEditDisplayText({ text: '🎉', secret: true }).text).toBe(BULLET);
  });

  it('paints an empty placeholder for a wholly bare LineEdit (edge case)', () => {
    expect(lineEditDisplayText({})).toEqual({ text: '', isPlaceholder: true });
  });

  it('truncates text longer than max_length (happy path)', () => {
    // set_max_length re-runs set_text, which truncates through insert_text_at_caret's
    // available_chars check (line_edit.cpp:2409-2412).
    expect(lineEditDisplayText({ text: 'hello world', maxLength: 5 })).toEqual({
      text: 'hello',
      isPlaceholder: false,
    });
  });

  it('truncates BEFORE the secret echo, so the echo length matches the truncated text', () => {
    expect(lineEditDisplayText({ text: 'hunter2', secret: true, maxLength: 3 }).text).toBe(BULLET.repeat(3));
  });

  it('max_length 0 (absent, or authored) means unlimited — the Godot default — text is never truncated', () => {
    expect(lineEditDisplayText({ text: 'a much longer string' }).text).toBe('a much longer string');
    expect(lineEditDisplayText({ text: 'a much longer string', maxLength: 0 }).text).toBe(
      'a much longer string'
    );
  });

  it('counts code points when truncating, not UTF-16 units (edge case)', () => {
    expect(lineEditDisplayText({ text: '🎉🎉🎉', maxLength: 2 }).text).toBe('🎉🎉');
  });

  it('leaves text untouched when it is already at or under max_length', () => {
    expect(lineEditDisplayText({ text: 'hi', maxLength: 5 }).text).toBe('hi');
  });
});
