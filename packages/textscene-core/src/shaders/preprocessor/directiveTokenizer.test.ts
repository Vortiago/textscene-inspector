import { describe, expect, it } from 'vitest';
import { DirectiveTokenizer } from './directiveTokenizer.js';
import { END } from './preprocessorChars.js';

describe('DirectiveTokenizer.token', () => {
  it('reads one space for a run of spaces and tabs', () => {
    const tokenizer = new DirectiveTokenizer('a \t b');
    expect([tokenizer.token(), tokenizer.token(), tokenizer.token()]).toEqual(['a', ' ', 'b']);
  });

  it('counts a line at each line feed', () => {
    const tokenizer = new DirectiveTokenizer('\n\n');
    tokenizer.token();
    tokenizer.token();
    expect(tokenizer.line).toBe(2);
  });

  it('reads the closing 0, then nothing but the end', () => {
    const tokenizer = new DirectiveTokenizer('');
    expect([tokenizer.token(), tokenizer.token()]).toEqual([END, END]);
  });
});

describe('DirectiveTokenizer.identifier', () => {
  it('skips leading whitespace and stops at a bracket', () => {
    expect(new DirectiveTokenizer('  NAME(x)').identifier()).toBe('NAME');
  });

  it('gives an empty string for a word that is no identifier', () => {
    expect(new DirectiveTokenizer('1abc').identifier()).toBe('');
  });

  it('reads on over a line continuation and generates its line break', () => {
    const tokenizer = new DirectiveTokenizer('AB\\\ncd');
    expect(tokenizer.identifier()).toBe('ABcd');
    expect(tokenizer.takeGenerated()).toBe('\n');
  });
});

describe('DirectiveTokenizer.directiveName', () => {
  it('reads the name right after the #', () => {
    expect(new DirectiveTokenizer('define X').directiveName()).toBe('define');
  });

  it('stops at whitespace before any name, giving none', () => {
    expect(new DirectiveTokenizer(' define').directiveName()).toBe('');
  });

  it('gives none at a line end', () => {
    expect(new DirectiveTokenizer('\nx').directiveName()).toBe('');
  });
});

describe('DirectiveTokenizer.advance', () => {
  it('reads up to and with the character', () => {
    const tokenizer = new DirectiveTokenizer('ab"c');
    expect([tokenizer.advance('"'), tokenizer.token()]).toEqual(['ab"', 'c']);
  });

  it('stops at the closing 0 when the character never comes, and then reads nothing', () => {
    const tokenizer = new DirectiveTokenizer('abc');
    expect([tokenizer.advance('"'), tokenizer.advance('"')]).toEqual([`abc${END}`, '']);
  });

  it('generates a line break for each line feed it passes', () => {
    const tokenizer = new DirectiveTokenizer('a\nb\n');
    tokenizer.advance('b');
    expect([tokenizer.line, tokenizer.takeGenerated()]).toEqual([1, '\n']);
  });
});

describe('DirectiveTokenizer.consumeLineContinuations', () => {
  it('counts each backslash and line feed it skips', () => {
    const tokenizer = new DirectiveTokenizer('\\\n \\\nx');
    expect(tokenizer.consumeLineContinuations(0)).toBe(2);
  });

  it('stops at a backslash with no line feed after it', () => {
    expect(new DirectiveTokenizer('\\x').consumeLineContinuations(0)).toBe(0);
  });

  it('skips the character after the line feed too, as Godot does', () => {
    const tokenizer = new DirectiveTokenizer('\\\nab');
    tokenizer.consumeLineContinuations(0);
    expect(tokenizer.token()).toBe('a');
    const skipping = new DirectiveTokenizer('\\\n\\\nab');
    skipping.consumeLineContinuations(0);
    expect(skipping.token()).toBe('\\');
  });
});

describe('DirectiveTokenizer.backtrack', () => {
  it('moves back to the last occurrence of the character', () => {
    const tokenizer = new DirectiveTokenizer('#if x');
    tokenizer.advance('x');
    tokenizer.backtrack('#');
    expect(tokenizer.token()).toBe('#');
  });

  it('stays on the character when it is the current one', () => {
    const tokenizer = new DirectiveTokenizer('a#');
    tokenizer.token();
    tokenizer.backtrack('#');
    expect(tokenizer.token()).toBe('#');
  });

  it('moves back over earlier lines', () => {
    const tokenizer = new DirectiveTokenizer('#a\nb\nc');
    tokenizer.advance('c');
    tokenizer.backtrack('#');
    expect(tokenizer.token()).toBe('#');
  });
});

describe('DirectiveTokenizer.peekIdentifier', () => {
  it('reads the identifier and puts the place back', () => {
    const tokenizer = new DirectiveTokenizer('endif\n');
    expect([tokenizer.peekIdentifier(), tokenizer.token()]).toEqual(['endif', 'e']);
  });

  it('keeps the line breaks a continuation generated, as Godot does', () => {
    const tokenizer = new DirectiveTokenizer('a\\\nb');
    tokenizer.peekIdentifier();
    expect([tokenizer.line, tokenizer.takeGenerated()]).toEqual([0, '\n']);
  });

  it('gives an empty string at the end', () => {
    expect(new DirectiveTokenizer('').peekIdentifier()).toBe('');
  });
});

describe('DirectiveTokenizer.columnOfLast', () => {
  it('counts from 1 on the first line', () => {
    const tokenizer = new DirectiveTokenizer('  #');
    tokenizer.token();
    tokenizer.token();
    expect(tokenizer.columnOfLast()).toBe(3);
  });

  it('counts from the last line feed', () => {
    const tokenizer = new DirectiveTokenizer('ab\n#');
    for (let read = 0; read < 4; read += 1) tokenizer.token();
    expect(tokenizer.columnOfLast()).toBe(1);
  });

  it('is 1 for the first character', () => {
    const tokenizer = new DirectiveTokenizer('#');
    tokenizer.token();
    expect(tokenizer.columnOfLast()).toBe(1);
  });
});
