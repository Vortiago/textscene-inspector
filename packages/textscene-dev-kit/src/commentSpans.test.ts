import { describe, expect, it } from 'vitest';
import { commentSpans, stripComments } from './commentSpans';

describe('commentSpans', () => {
  it('finds block and line comments with their offsets', () => {
    const src = "const a = 1; // trailing\n/* block\nspans lines */\nconst b = 2;";
    const spans = commentSpans(src);
    expect(spans.map((s) => s.text)).toEqual(['// trailing', '/* block\nspans lines */']);
    expect(spans[0]!.index).toBe(src.indexOf('// trailing'));
  });

  it('does not read a URL inside code as a line comment', () => {
    expect(commentSpans("const u = 'https://example.com';")).toEqual([]);
  });

  it('blockOnly ignores CSS-invalid line comments', () => {
    const spans = commentSpans('a { color: red; } /* note */ // not css', { blockOnly: true });
    expect(spans.map((s) => s.text)).toEqual(['/* note */']);
  });
});

describe('stripComments', () => {
  it('blanks comments while preserving length and newlines', () => {
    const src = "keep(); /* gone\nstill gone */ also(); // gone";
    const out = stripComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split('\n').length).toBe(src.split('\n').length);
    expect(out).toContain('keep();');
    expect(out).toContain('also();');
    expect(out).not.toContain('gone');
  });
});
