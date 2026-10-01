/**
 * Which jackets and escapes a STRING slot takes. `variant_parser.cpp:263-265`
 * tokenizes `&"…"` and `@"…"` as one StringName, and `:920-939` reads
 * `NodePath("…")`. Both are strict sources for STRING (`variant.cpp:582-589`,
 * gated by `binder_common.h:175`). There is no `^` token, so `^"…"` stays a
 * format error.
 */

import { describe, expect, it } from 'vitest';
import { v } from '../v.js';
import '../../index.js';
import { node, scene, expectNoDiagnostic } from '../../testing/testkit';

const CUT = 'line_edit.cpp:2608';

describe('v.quotedString', () => {
  it('accepts the StringName jacket in both spellings', () => {
    expect(v.quotedString('text')('text', '&"Hello"', 1)).toBeNull();
    expect(v.quotedString('text')('text', '@"Hello"', 1)).toBeNull();
  });

  it('still rejects a bare word, a jacket with nothing quoted, and a jacket Godot does not tokenize', () => {
    expect(v.quotedString('text')('text', 'Hello', 1)).not.toBeNull();
    expect(v.quotedString('text')('text', '&Hello', 1)).not.toBeNull();
    expect(v.quotedString('text')('text', '^"Hello"', 1)).not.toBeNull();
  });

  it('accepts a NodePath literal, which the slot converts to its text', () => {
    expect(v.quotedString('text')('text', 'NodePath("Hello")', 1)).toBeNull();
    expect(v.quotedString('text')('text', 'NodePath("")', 1)).toBeNull();
  });
});

describe('v.stringName', () => {
  it('refuses a NodePath literal, since STRING_NAME converts only from STRING', () => {
    // `variant.cpp:738-744`: `case STRING_NAME: valid[] = { STRING, NIL }`.
    expect(v.stringName('animation')('animation', 'NodePath("walk")', 1)?.severity).toBe('error');
  });
});

describe('v.singleCharacter', () => {
  it('counts the character inside a StringName jacket', () => {
    const validator = v.singleCharacter('secret_character', { enforced: CUT });
    expect(validator('secret_character', '&"*"', 1)).toBeNull();
    expect(validator('secret_character', '&"**"', 1)?.message).toContain('2 characters');
  });

  it('counts the character inside a NodePath literal, which converts to its text', () => {
    const validator = v.singleCharacter('secret_character', { enforced: CUT });
    expect(validator('secret_character', 'NodePath("*")', 1)).toBeNull();
    expect(validator('secret_character', 'NodePath("**")', 1)?.message).toContain('2 characters');
  });

  // `variant_parser.cpp:299-300`: `case 'b': res = 8` is one character, and
  // `:350-351` `default: res = next` makes `\'` a single `'`.
  it('counts an escape the tokenizer decodes as one character', () => {
    const validator = v.singleCharacter('secret_character', { enforced: CUT });
    expect(validator('secret_character', '"\\b"', 1)).toBeNull();
    expect(validator('secret_character', '"\\\'"', 1)).toBeNull();
  });
});

describe('string slots through the linter', () => {
  it('Label.text takes the StringName jacket', () => {
    expectNoDiagnostic(scene(node('Label', { text: '&"Hello"' })), { prop: 'text' });
  });

  it('LineEdit.secret_character takes the StringName jacket', () => {
    expectNoDiagnostic(scene(node('LineEdit', { secret_character: '&"*"' })), { prop: 'secret_character' });
  });
});
