/** `literal` with every RegExp metacharacter escaped, so a pattern built from it matches the text exactly. */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
