import type { EnumValue } from '../classdb/enumNames.js';

/** The `Error` a parse stops with (error_list.h:63, :65, :90): a corrupt file where text ends in a tag. */
export const GodotError = {
  ParseError: 'ERR_PARSE_ERROR',
  FileCorrupt: 'ERR_FILE_CORRUPT',
  FileEof: 'ERR_FILE_EOF',
} as const;
export type ParseErrorCode = EnumValue<typeof GodotError>;

/** The name Godot prints for each code (error_list.cpp:53, :55, :80). */
export const ERROR_NAMES: Readonly<Record<ParseErrorCode, string>> = {
  ERR_PARSE_ERROR: 'Parse error',
  ERR_FILE_CORRUPT: 'File corrupt',
  ERR_FILE_EOF: 'End of file',
};

/** A text the value or tag parser refuses: Godot's message and the code it returns. */
export class ParseError extends Error {
  constructor(
    message: string,
    readonly code: ParseErrorCode = GodotError.ParseError
  ) {
    super(message);
  }
}
