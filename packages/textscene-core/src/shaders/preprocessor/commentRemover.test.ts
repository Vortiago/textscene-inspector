/** The comment remover, against `CommentRemover::strip` (`shader_preprocessor.cpp:245`). */

import { describe, expect, it } from 'vitest';
import { stripComments } from './commentRemover.js';

describe('stripComments', () => {
  it('removes a line comment and keeps its line break', () => {
    expect(stripComments('a // b\nc').code).toBe('a \nc');
  });

  it('removes a block comment and keeps each line break inside it', () => {
    expect(stripComments('a /* b\n\nc */ d').code).toBe('a \n\n d');
  });

  it('keeps a comment marker inside a string', () => {
    expect(stripComments('"// not a comment" x').code).toBe('"// not a comment" x');
  });

  it("refuses an unclosed block comment on its opening line with Godot's message", () => {
    expect(stripComments('a\n/* b').error).toEqual({ message: 'Block comment mismatch', line: 1 });
  });

  it('refuses a stray end of a block comment, and drops its star', () => {
    expect(stripComments('a */ b')).toEqual({
      code: 'a / b',
      error: { message: 'Block comment mismatch', line: 0 },
    });
  });
});
