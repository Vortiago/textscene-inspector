// Godot's `xid_start` table adds `_` (char_range.inc:47).
const IDENTIFIER_START = /^[\p{XID_Start}_]$/u;
const IDENTIFIER_CONTINUE = /^\p{XID_Continue}$/u;

export const isUnicodeIdentifierStart = (char: string): boolean => IDENTIFIER_START.test(char);

/** char_range.inc:733 */
export const isUnicodeIdentifierContinue = (char: string): boolean => IDENTIFIER_CONTINUE.test(char);
