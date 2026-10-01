/**
 * `text` as a glob that matches it in any case: each letter becomes a class of its two cases. A VS Code glob matches
 * case-sensitively, and its matcher reads a class inside a brace alternative too (`src/vs/base/common/glob.ts`).
 */
export function anyCase(text: string): string {
  return text.replace(/[a-z]/gi, (letter) => `[${letter.toLowerCase()}${letter.toUpperCase()}]`);
}
