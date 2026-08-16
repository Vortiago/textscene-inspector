/**
 * Shared comment lexing for the dev-kit and core guards: ONE place decides what
 * counts as a comment.
 *
 * A SCANNER, not a regex pair. The regex version read `/*` and `//` wherever
 * they appeared, including inside a string or a regex literal, and this
 * codebase is full of both: wildcard property keys are spelled
 * `'theme_override_colors/*'`, `'popup/item_#/*'`, `'settings/#/*'`, and
 * several slices hold patterns like `/^item_(-?\d+)\//`. Each of those opened a
 * comment that ran to the next real close-comment or end of line. Measured over the
 * 1,986 core source files: five files lost real source that way, the worst
 * swallowing 9,982 characters at `linter/propertyGrammarParityAllowlist/
 * baseTypes.ts:83`, and the naive `//` half damaged eleven more.
 *
 * Nothing depended on the blanked-away source at the time, which is exactly why
 * it survived: the guards reading this all assert an empty list, and blanked
 * source is silently absent rather than wrong.
 */

/** Where a regex literal may begin: after an operator or an opener, never after a value. */
const REGEX_ALLOWED_AFTER = /[(,=:[!&|?{};+\-*%^~<>]$/;

/** Module level: this is tested once per source CHARACTER. */
const WHITESPACE = /\s/;

/** Comment spans with their source offsets. `blockOnly` restricts to block comments. */
export function commentSpans(
  source: string,
  opts: { blockOnly?: boolean } = {}
): { index: number; text: string }[] {
  const spans: { index: number; text: string }[] = [];
  let i = 0;
  /** The last non-whitespace character outside a literal, for the regex test. */
  let prev = '';

  const skipString = (quote: string): void => {
    i++;
    while (i < source.length) {
      const c = source[i]!;
      if (c === '\\') i += 2;
      else if (c === quote) return void i++;
      // A template can hold `${ … }` with arbitrary code, comments included.
      // Not descended into: a comment inside an interpolation is vanishingly
      // rare, and treating the whole template as opaque is the safe direction —
      // it under-reports comments rather than blanking real source.
      else i++;
    }
  };

  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];

    if (c === '"' || c === "'" || c === '`') {
      skipString(c);
      prev = c;
      continue;
    }

    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      spans.push({ index: i, text: source.slice(i, stop) });
      i = stop;
      continue;
    }

    if (c === '/' && next === '/' && !opts.blockOnly) {
      const nl = source.indexOf('\n', i);
      const stop = nl === -1 ? source.length : nl;
      spans.push({ index: i, text: source.slice(i, stop) });
      i = stop;
      continue;
    }

    // A regex literal, whose body may hold `//` or `/*`. Told from a division
    // by what precedes it, the standard lexical test.
    if (c === '/' && REGEX_ALLOWED_AFTER.test(prev)) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const r = source[j]!;
        if (r === '\\') j += 2;
        else if (r === '[') {
          inClass = true;
          j++;
        } else if (r === ']') {
          inClass = false;
          j++;
        }
        else if (r === '\n') break; // unterminated: not a regex after all
        else if (r === '/' && !inClass) {
          j++;
          break;
        } else j++;
      }
      i = j;
      prev = '/';
      continue;
    }

    if (!WHITESPACE.test(c)) prev = c;
    i++;
  }
  return spans;
}

/**
 * Blank every comment (newlines preserved, length preserved) so a scan over
 * the result never fires on commented-out code.
 */
export function stripComments(source: string): string {
  // Assembled once. Rebuilding the whole string per span is O(n x spans), and
  // the core corpus averages 8 spans a file with a worst case of 122.
  const parts: string[] = [];
  let at = 0;
  for (const span of commentSpans(source)) {
    parts.push(source.slice(at, span.index));
    // Same-length replacement, newlines kept — offsets into the result stay
    // valid, which is what every caller scans by.
    parts.push(span.text.replace(/[^\n]/g, ' '));
    at = span.index + span.text.length;
  }
  parts.push(source.slice(at));
  return parts.join('');
}
