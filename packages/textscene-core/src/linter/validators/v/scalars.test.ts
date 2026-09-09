/**
 * The string combinators: which jackets and escapes a STRING slot takes.
 *
 * `variant_parser.cpp:263-265` tokenizes `&"…"` and the 3.x-compatible `@"…"`
 * as one StringName, `variant.cpp:582-587` lists `STRING_NAME` as a strict
 * source for `STRING`, and `VariantCasterAndValidate` (`binder_common.h:175`)
 * gates a setter argument on `can_convert_strict` — so `text = &"Hello"`
 * stores `Hello`. There is no `^` token in the tokenizer, so `^"…"` stays a
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
});

describe('v.singleCharacter', () => {
  it('counts the character inside a StringName jacket', () => {
    const validator = v.singleCharacter('secret_character', { enforced: CUT });
    expect(validator('secret_character', '&"*"', 1)).toBeNull();
    expect(validator('secret_character', '&"**"', 1)?.message).toContain('2 characters');
  });

  // `variant_parser.cpp:299-300`: `case 'b': res = 8` — one character, and
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
    expectNoDiagnostic(
      scene(node('LineEdit', { secret_character: '&"*"' })),
      { prop: 'secret_character' }
    );
  });
});
