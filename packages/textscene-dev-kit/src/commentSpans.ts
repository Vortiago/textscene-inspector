/**
 * Shared comment lexing for the dev-kit guards: ONE place decides what counts
 * as a comment — block comments everywhere, `// …` line comments guarded by
 * `(?<!:)` so `https://…` inside code is never read as one. Used by the
 * import-closure walker (blank comments before scanning for dynamic imports)
 * and the comment-conventions guard (scan only comments for tracker refs).
 */

/**
 * Comment spans with their source offsets. `blockOnly` restricts to block
 * comments (CSS has no line comments).
 */
export function commentSpans(
  source: string,
  opts: { blockOnly?: boolean } = {}
): { index: number; text: string }[] {
  const pattern = opts.blockOnly
    ? /\/\*[\s\S]*?\*\//g
    : /\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g;
  const spans: { index: number; text: string }[] = [];
  for (const match of source.matchAll(pattern)) {
    spans.push({ index: match.index, text: match[0] });
  }
  return spans;
}

/**
 * Blank every comment (newlines preserved, length preserved) so a scan over
 * the result never fires on commented-out code.
 */
export function stripComments(source: string): string {
  let out = source;
  for (const span of commentSpans(source)) {
    // Same-length replacement — later span indices stay valid.
    const blanked = span.text.replace(/[^\n]/g, ' ');
    out = out.slice(0, span.index) + blanked + out.slice(span.index + span.text.length);
  }
  return out;
}
