/**
 * A CSS module read as text, for the tests that pin a responsive or pointer rule. happy-dom
 * evaluates no `@media` and `matchMedia` answers `false`, so the source is the only place
 * such a rule can be checked. Test-only: the `testing/` directories under `src` are excluded
 * from the build.
 */

/** The query text of every `@media` rule in `source`, in order. */
export function mediaQueries(source: string): string[] {
  return Array.from(source.matchAll(/@media\s*([^{]+?)\s*\{/g), (m) => m[1]!);
}

/** The body of the `@media <query>` block, or null when there is none. */
export function extractMediaBlock(source: string, query: string): string | null {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`@media\\s*${escaped}\\s*\\{`).exec(source);
  if (!match) return null;
  const end = closingBrace(source, match.index + match[0].length);
  return end === null ? null : source.slice(match.index + match[0].length, end);
}

/** `source` without its `@media` blocks: the rules that hold at every width and pointer. */
export function stripMediaBlocks(source: string): string {
  let out = source;
  for (;;) {
    const start = /@media[^{]*\{/.exec(out);
    if (!start) return out;
    const end = closingBrace(out, start.index + start[0].length);
    if (end === null) return out;
    out = out.slice(0, start.index) + out.slice(end + 1);
  }
}

/** The index of the `}` that closes the block whose body starts at `bodyStart`. */
function closingBrace(source: string, bodyStart: number): number | null {
  let depth = 1;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') depth -= 1;
    if (depth === 0) return i;
  }
  return null;
}
