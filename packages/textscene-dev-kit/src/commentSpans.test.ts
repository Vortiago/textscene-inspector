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
    // CSS has no regex: a regex scan from `calc(100% / 3)` would swallow the `/*` after it.
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
    // `'theme_override_colors/*'` must open no block comment inside its string.
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
    // `return` is not an operator character, so without the keyword test the `\/\/` body would
    // open a line comment.
    const src = 'function f(s) {\n  return /https?:\\/\\//.test(s);\n}';
    expect(stripComments(src)).toBe(src);
  });

  it('descends into a template interpolation, so backtick parity survives it', () => {
    // An opaque `${…}` flips parity on a nested template: the closing backtick reads as an opening
    // one, and every later comment sits inside a string that never ends.
    const src = 'const a = `x${`y`}z`;\n// note\nconst b = 1;';
    const out = stripComments(src);
    expect(out).toContain('const a = `x${`y`}z`;');
    expect(out).not.toContain('note');
  });

  it('does not start a regex scan at a JSX close tag', () => {
    // `<` opens a regex in JS, but in a `.tsx` file `</div>` is a close tag.
    const src = 'const el = <div>Done</div>;\n// note\nconst b = 1;';
    const out = stripComments(src);
    expect(out).toContain('const el = <div>Done</div>;');
    expect(out).not.toContain('note');
    expect(out).toHaveLength(src.length);
  });

  it('does not start a regex scan at a self-closing JSX tag', () => {
    // `} />` is the close tag's twin: the `/` follows the `}` of the last expression attribute,
    // and a regex reading consumes the rest of the line, trailing comment included.
    expect(commentSpans('const el = <Foo bar={1} />; // note').map((s) => s.text)).toEqual([
      '// note',
    ]);
    expect(commentSpans('<Foo style={{a:1}} />; /* blk */').map((s) => s.text)).toEqual([
      '/* blk */',
    ]);
  });

  it('still reads a division and a JSX expression child as code, not as a regex', () => {
    // The counterpart to the two above: dropping `}` must not stop the lexer
    // seeing the comment after an ordinary expression.
    expect(commentSpans('const el = <div>{x}</div>; // note').map((s) => s.text)).toEqual([
      '// note',
    ]);
    expect(commentSpans('arr[0] / 2; // note').map((s) => s.text)).toEqual(['// note']);
  });

  it('does not let an apostrophe in JSX text open a string past its line', () => {
    // A quoted string cannot hold a raw newline, so an unterminated one ends with its line
    // instead of running to the next `'` in the file.
    const src = "const el = <p>Don't</p>;\n// note\nconst b = 1;";
    expect(commentSpans(src).map((s) => s.text)).toEqual(['// note']);
  });
});
