/**
 * Bracket- and quote-aware scanning of TypeScript source text, for guards that read a
 * table or a call's arguments out of a file.
 */

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSERS = new Set(Object.values(OPENERS));
const QUOTES = new Set(["'", '"', '`']);

/**
 * Walk `text` from `from`, calling `at` with each index at nesting depth 0. A
 * comma inside a string literal is no separator, and the `>` of an arrow type
 * closes nothing. The scan tracks `<`, because a generic parameter type is far
 * more common in the scanned source than a comparison.
 */
function scanTopLevel(text: string, from: number, at: (index: number, depth: number) => boolean): void {
  let depth = 0;
  let quote = '';
  for (let i = from; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
      continue;
    }
    if (QUOTES.has(ch)) {
      quote = ch;
      continue;
    }
    if (OPENERS[ch]) depth += 1;
    else if (CLOSERS.has(ch) && !(ch === '>' && text[i - 1] === '=')) depth -= 1;
    if (at(i, depth)) return;
  }
}

/**
 * The text from `open` (an index pointing at a bracket) to its match. It tracks
 * depth, since `[^)]*` stops at the first `)` inside a parameter list.
 */
export function balancedGroup(src: string, open: number): string {
  let end = -1;
  scanTopLevel(src, open, (i, depth) => {
    if (depth !== 0) return false;
    end = i;
    return true;
  });
  return end === -1 ? '' : src.slice(open + 1, end);
}

/** Split on top-level commas only, so a nested type never ends an entry. */
export function topLevelParts(body: string): string[] {
  const out: string[] = [];
  let start = 0;
  scanTopLevel(body, 0, (i, depth) => {
    if (depth === 0 && body[i] === ',') {
      out.push(body.slice(start, i));
      start = i + 1;
    }
    return false;
  });
  if (body.slice(start).trim() !== '') out.push(body.slice(start));
  return out;
}
