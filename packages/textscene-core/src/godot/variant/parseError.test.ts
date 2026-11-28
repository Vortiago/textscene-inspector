import { describe, expect, it } from 'vitest';
import { ERROR_NAMES, GodotError, ParseError } from './parseError';

describe('ParseError', () => {
  it('stops with ERR_PARSE_ERROR when no code is given', () => {
    expect(new ParseError("Expected ']'").code).toBe(GodotError.ParseError);
  });

  it('keeps the code it is given', () => {
    expect(new ParseError('Unexpected EOF', GodotError.FileCorrupt).code).toBe('ERR_FILE_CORRUPT');
  });

  it("keeps Godot's message", () => {
    expect(new ParseError("Expected ']'").message).toBe("Expected ']'");
  });
});

describe('ERROR_NAMES', () => {
  it('names each code as error_list.cpp prints it', () => {
    expect(ERROR_NAMES[GodotError.ParseError]).toBe('Parse error');
    expect(ERROR_NAMES[GodotError.FileCorrupt]).toBe('File corrupt');
  });
});
