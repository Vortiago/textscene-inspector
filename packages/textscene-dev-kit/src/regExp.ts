/** `literal` with every RegExp metacharacter escaped, so a pattern built from it matches the text exactly. */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whitespace and comments, as a RegExp source to place between two tokens. It is for a prefilter
 * on raw text: a string that looks like a comment can only widen the match, never narrow it.
 */
export const TRIVIA = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*`;
