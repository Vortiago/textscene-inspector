/**
 * One grammar for a `"…"` string literal, `STRING_LITERAL_SOURCE` in `godot/string.ts`. A copy
 * drifts from the tokenizer: `\\.` for its escape refuses a backslash before a raw newline, which
 * `variant_parser.cpp:276-290` reads as one escape, so a copy rejects a scene Godot loads.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, srcLabel } from './testing/ruleNameScrape.js';

/**
 * The class that spells an escape-aware literal body: everything but `"` and `\`, in either
 * order, as a regex literal or `String.raw` writes it (two backslashes) or a plain string
 * does (four). A body with no escape, `"[^"]*"`, is a narrower grammar for an id or a
 * base64 payload, which never holds a quote, and stays legal.
 */
const ESCAPE_AWARE_QUOTE_CLASS = /\[\^(?:"(?:\\\\){1,2}|(?:\\\\){1,2}")\]/;

/** Whether `source` spells the string-literal body itself, comments aside. */
function spellsStringLiteral(source: string): boolean {
  return ESCAPE_AWARE_QUOTE_CLASS.test(stripComments(source));
}

describe('Godot string literal grammar', () => {
  it('is spelled once, in godot/string.ts', () => {
    // Exactly one file, not an empty list: the definition is the anti-vacuity term.
    const spellers = allSourceFiles()
      .filter((file) => spellsStringLiteral(readFileSync(file, 'utf8')))
      .map(srcLabel)
      .sort();
    expect(spellers).toEqual(['godot/string.ts']);
  });

  it('sees the class in each spelling, and leaves an escape-free body alone', () => {
    expect(spellsStringLiteral(String.raw`const RE = /^"(?:[^"\\]|\\.)*"$/;`)).toBe(true);
    expect(spellsStringLiteral(String.raw`const RE = /^"(?:[^\\"]|\\.)*"$/;`)).toBe(true);
    expect(spellsStringLiteral(String.raw`const RE = new RegExp('"(?:[^"\\\\]|\\\\.)*"');`)).toBe(
      true
    );
    expect(spellsStringLiteral(String.raw`const RE = /^"([^"]*)"$/;`)).toBe(false);
    // A comment that quotes the grammar is not a copy of it.
    expect(spellsStringLiteral(String.raw`// the tokenizer's [^"\\] body`)).toBe(false);
  });
});
