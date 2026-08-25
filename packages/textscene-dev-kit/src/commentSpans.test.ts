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

  it('blockOnly does not read a CSS division as a regex literal', () => {
    // The failure this branch exists for: `calc(100% / 3)` opened a regex scan
    // that ran forward and swallowed the `/*` after it, so every comment in the
    // file below that line left the conventions guard in silence.
    const spans = commentSpans('a { width: calc(100% / 3); }\n/* kept */\n', {
      blockOnly: true,
    });
    expect(spans.map((s) => s.text)).toEqual(['/* kept */']);
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

describe('literals are not comments', () => {
  it('leaves a wildcard property key alone', () => {
    // `'theme_override_colors/*'` opened a block comment that ran to the next
    // real `*/`, blanking up to 9,982 characters of real source.
    const src = "const KEYS = ['theme_override_colors/*'];\nconst x = 1;\n/** doc */\nconst y = 2;";
    expect(stripComments(src)).toBe(
      "const KEYS = ['theme_override_colors/*'];\nconst x = 1;\n          \nconst y = 2;"
    );
  });

  it('leaves a `//` inside a string literal alone', () => {
    expect(stripComments('const sep = "//";\nconst n = 1;')).toBe('const sep = "//";\nconst n = 1;');
  });

  it('leaves a regex literal ending in an escaped slash alone', () => {
    const src = 'const RE = /^item_(-?\\d+)\\//;\nconst after = 2;';
    expect(stripComments(src)).toBe(src);
  });

  it('still blanks a real comment beside all three', () => {
    const src = "const a = 'x/*y'; // note\nconst b = /a\\//; /* block */";
    const out = stripComments(src);
    expect(out).toContain("const a = 'x/*y';");
    expect(out).not.toContain('note');
    expect(out).not.toContain('block');
    expect(out).toHaveLength(src.length);
  });

  it('preserves offsets and newlines exactly', () => {
    const src = 'a\n/* one\ntwo */\nb';
    const out = stripComments(src);
    expect(out).toHaveLength(src.length);
    expect(out.split('\n')).toHaveLength(src.split('\n').length);
  });

  it('reads a regex after a keyword as a regex, not a division', () => {
    // `return` is not an operator character, so the regex branch never fired
    // and the `\/\/` body opened a line comment that ate the rest of the line.
    const src = 'function f(s) {\n  return /https?:\\/\\//.test(s);\n}';
    expect(stripComments(src)).toBe(src);
  });

  it('descends into a template interpolation, so backtick parity survives it', () => {
    // Treating `${…}` as opaque flips parity when the interpolation holds a
    // nested template: the closing backtick reads as an opening one and every
    // later comment in the file is inside a string that never ends.
    const src = 'const a = `x${`y`}z`;\n// note\nconst b = 1;';
    const out = stripComments(src);
    expect(out).toContain('const a = `x${`y`}z`;');
    expect(out).not.toContain('note');
  });

  it('does not start a regex scan at a JSX close tag', () => {
    // `<` opens a regex in JS, but in a `.tsx` file `</div>` is a close tag,
    // and scanning from it swallowed every later comment.
    const src = 'const el = <div>Done</div>;\n// note\nconst b = 1;';
    const out = stripComments(src);
    expect(out).toContain('const el = <div>Done</div>;');
    expect(out).not.toContain('note');
    expect(out).toHaveLength(src.length);
  });
});
