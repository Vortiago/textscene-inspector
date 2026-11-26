import { describe, expect, it } from 'vitest';
import { isEscapedNewline, readVariant, strToVar, Tokens } from './strToVar';
import { varToStr } from './varToStr';
import { VARIANT_TYPE as T } from './variantType';

// Each expected text is what Godot 4.6.3 prints for `var_to_str(str_to_var(input))`.
const roundTrip = (input: string) => varToStr(strToVar(input));

describe('strToVar', () => {
  it("stops a value that opens with a refused token with the token's own message", () => {
    expect(readVariant('"abc')).toEqual({ error: 'Unterminated string' });
  });

  it('reads a vector and writes its components in the canonical spelling', () => {
    expect(roundTrip('Vector3(0.1, -0, 1e20)')).toBe('Vector3(0.1, 0, 1e+20)');
  });

  it('stores a real component as a float32', () => {
    expect(strToVar('Vector2(0.1, 2)')).toEqual({ type: T.VECTOR2, value: [Math.fround(0.1), 2] });
  });

  it('reads integer vectors, transforms and projections', () => {
    expect(roundTrip('Vector2i(3, -4)')).toBe('Vector2i(3, -4)');
    expect(roundTrip('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 2, 3)')).toBe(
      'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 2, 3)'
    );
    expect(roundTrip('Quaternion(0, 0, 0.7071068, 0.7071068)')).toBe(
      'Quaternion(0, 0, 0.7071068, 0.7071068)'
    );
  });

  it('stores an infinity or a NaN in an integer component as 0, as the int64 cast does on x86', () => {
    expect(roundTrip('Vector2i(inf, nan)')).toBe('Vector2i(0, 0)');
    expect(roundTrip('PackedByteArray(inf)')).toBe('PackedByteArray(0)');
  });

  it('reads strings, string names and node paths with their escapes', () => {
    expect(roundTrip('"tab\\there \\"q\\" é"')).toBe('"tab\there \\"q\\" é"');
    expect(roundTrip('&"name"')).toBe('&"name"');
    expect(roundTrip('NodePath("a/b:c")')).toBe('NodePath("a/b:c")');
  });

  it('writes a dictionary with its keys sorted, numbers before strings', () => {
    expect(roundTrip('{"b": 1, "a": 2, 3: 4}')).toBe('{\n3: 4,\n"a": 2,\n"b": 1\n}');
  });

  it('keeps the element type of a typed array and dictionary', () => {
    expect(roundTrip('Array[int]([1, 2])')).toBe('Array[int]([1, 2])');
    expect(roundTrip('Dictionary[String, int]({"a": 1})')).toBe('Dictionary[String, int]({\n"a": 1\n})');
  });

  it('writes a packed byte array as a list of bytes, whichever form it read', () => {
    expect(roundTrip('PackedByteArray("AQID")')).toBe('PackedByteArray(1, 2, 3)');
  });

  it('writes a float with its point and the named numbers by name', () => {
    expect(['1.0', '-0.0', '123456789012', 'inf', 'nan', '1e-7'].map(roundTrip)).toEqual([
      '1.0',
      '0.0',
      '123456789012',
      'inf',
      'nan',
      '1e-07',
    ]);
  });

  it('reads a colour that runs to the end of the text as the end, so the text is not a value', () => {
    expect(readVariant('#ff8000')).toHaveProperty('error');
    expect(strToVar('[#ff8000]')).toEqual({
      type: T.ARRAY,
      elements: [{ type: T.COLOR, value: [1, Math.fround(128 / 255), 0, 1] }],
    });
  });

  it('answers null for text that is not a value', () => {
    expect(strToVar('Vector3(1, 2')).toEqual({ type: T.NIL });
    expect(readVariant('Vector3(1, 2')).toEqual({ error: expect.any(String) });
  });

  it('refuses an object of a class that does not exist', () => {
    expect(readVariant('Object(NoSuchClass,"a":1)', { classExists: () => false })).toHaveProperty('error');
  });
});

describe('Tokens', () => {
  const lineOfSecondToken = (text: string) => {
    const tokens = new Tokens(text);
    tokens.next();
    tokens.next();
    return tokens.tokenStart.line;
  };

  it('counts a newline read as white space', () => {
    expect(lineOfSecondToken('a\n\nb')).toBe(3);
  });

  it('counts the newline that ends a comment', () => {
    expect(lineOfSecondToken('a ; note\nb')).toBe(2);
  });

  it('skips a newline a string escapes, as the string counter does', () => {
    expect(lineOfSecondToken('"x\\\ny" b')).toBe(1);
  });

  it('counts a newline inside a string that no backslash escapes', () => {
    expect(lineOfSecondToken('"x\ny" b')).toBe(2);
  });

  it('reads a NUL as the end of the stream', () => {
    expect(new Tokens('\0a').next()).toEqual({ kind: 'eof' });
  });

  it('refuses a string a NUL cuts, as Godot does', () => {
    expect(new Tokens('"a\0b"').next()).toEqual({ kind: 'error', message: 'Unterminated string' });
    expect(new Tokens('"a\\\0b"').next()).toEqual({ kind: 'error', message: 'Unterminated string' });
  });

  it('drops the NUL that ends a word, a number or a colour, as `saved` holds none', () => {
    const second = (text: string) => {
      const tokens = new Tokens(text);
      tokens.next();
      return tokens.next();
    };
    expect(second('a\0b')).toEqual({ kind: 'identifier', text: 'b' });
    expect(second('1\0b')).toEqual({ kind: 'identifier', text: 'b' });
    expect(second('#fff\0b')).toEqual({ kind: 'identifier', text: 'b' });
    expect(second('"a"\0b')).toEqual({ kind: 'eof' });
  });

  it('refuses a hex escape a NUL cuts as an unterminated string (variant_parser.cpp:321)', () => {
    expect(new Tokens('"\\u00\0a"').next()).toEqual({ kind: 'error', message: 'Unterminated string' });
  });

  it('is not at the end before a read finds it', () => {
    const tokens = new Tokens('a');
    expect(tokens.isEof).toBe(false);
    tokens.next();
    expect(tokens.next()).toEqual({ kind: 'eof' });
    expect(tokens.isEof).toBe(true);
  });
});

describe('isEscapedNewline', () => {
  it('is true after an odd run of backslashes', () => {
    expect(isEscapedNewline('"a\\\\\\\n', 5)).toBe(true);
  });

  it('is false after an even run of backslashes', () => {
    expect(isEscapedNewline('"a\\\\\n', 4)).toBe(false);
  });

  it('counts a run that starts the text', () => {
    expect(isEscapedNewline('\\\n', 1)).toBe(true);
  });

  it('is false where a carriage return sits between the backslash and the newline', () => {
    expect(isEscapedNewline('"a\\\r\n', 4)).toBe(false);
  });
});
