/**
 * Shared comment lexing for the dev-kit and core guards: ONE place decides what
 * counts as a comment.
 *
 * A SCANNER, not a regex pair, because this codebase is full of text that
 * merely looks like a comment: wildcard property keys are spelled
 * `'theme_override_colors/*'`, `'popup/item_#/*'`, `'settings/#/*'`, and
 * several slices hold patterns like `/^item_(-?\d+)\//`. To a regex each of
 * those opens a comment that runs to the next close or end of line.
 *
 * Its failures are silent in both directions — blanked source is absent from a
 * scan rather than wrong, and a missed comment lets commented-out code answer
 * one — so correctness is not left to review:
 * `commentSpans.conformance.test.ts` asserts this agrees with the TypeScript
 * parser on every tracked file.
 */

/**
 * Where a regex literal may begin: after an operator or an opener, never after
 * a value.
 *
 * `>` stays in the set for `x => /re/.test(x)`. `<` and `}` are deliberately
 * absent, for one reason in two spellings: `</div>` and `<Foo bar={1} />` end
 * every JSX element, and reading either slash as a regex opener scans away the
 * rest of the line and the comment on it. Neither loses a real literal — no
 * expression usefully compares against a regex, and a regex opening a statement
 * straight after a block's closing brace is not a form this tree writes.
 * `${` sets `prev` to `{`, so an interpolated regex is unaffected.
 */
const REGEX_ALLOWED_AFTER = /[(,=:[!&|?{;+\-*%^~>]$/;

/**
 * A regex may also open after a KEYWORD, where the preceding character is a
 * letter and the operator test above cannot see it — `return /re/.test(s)` is
 * the common one, and reading its slash as division let the `\/\/` in a URL
 * pattern open a comment that blanked the rest of the line.
 */
const REGEX_ALLOWED_AFTER_KEYWORD =
  /\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

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
  /** Its index, so the keyword test can read back over the whole identifier. */
  let prevEnd = 0;

  /**
   * Open template literals, innermost last, each holding the `{` depth reached
   * inside its current `${ … }`.
   *
   * ONE loop scans code and interpolations alike. A second copy of the lexer
   * for interpolation bodies is what let `.replace(/"/g, '\\"')` inside one
   * open a string that never closed: every construct the outer loop knows
   * about — regex literals above all — has to be known inside `${ … }` too,
   * and a stack keeps that true by construction rather than by maintenance.
   */
  const templates: { braces: number }[] = [];

  /**
   * A `'`/`"` string, which ENDS WITH ITS LINE when the closing quote never
   * arrives: only a template literal may hold a raw newline, so a scan running
   * past one is reading text that is not a string. JSX prose is where that
   * happens — the apostrophe in `<p>Don't</p>` opened a string that ran to the
   * next `'` anywhere in the file, blanking every comment in between.
   * The escape branch still consumes `\<newline>`, so a line continuation
   * inside a real string keeps working.
   */
  const skipQuoted = (quote: string): void => {
    i++;
    while (i < source.length) {
      const c = source[i]!;
      if (c === '\\') i += 2;
      else if (c === quote) return void i++;
      else if (c === '\n') return;
      else i++;
    }
  };

  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    const template = templates.at(-1);

    // Inside a template's TEXT: only its close, an escape, and `${` matter.
    if (template !== undefined && template.braces === 0) {
      if (c === '\\') i += 2;
      else if (c === '`') {
        templates.pop();
        prev = '`';
        prevEnd = ++i;
      } else if (c === '$' && next === '{') {
        template.braces = 1;
        i += 2;
        // A regex may open immediately after `${`.
        prev = '{';
        prevEnd = i;
      } else i++;
      continue;
    }

    if (c === '`') {
      templates.push({ braces: 0 });
      i++;
      continue;
    }

    // `}` closing the innermost `${ … }` returns to that template's text.
    if (template !== undefined && (c === '{' || c === '}')) {
      template.braces += c === '{' ? 1 : -1;
      i++;
      prev = c;
      prevEnd = i;
      continue;
    }

    if (c === '"' || c === "'") {
      skipQuoted(c);
      prev = c;
      prevEnd = i;
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
    //
    // `blockOnly` is CSS, which has no regex literal at all: `calc(100% / 3)`
    // opened a scan that ran forward and swallowed the `/*` of the comment
    // after it, so every CSS block comment fell out of the conventions guard.
    if (
      c === '/' &&
      !opts.blockOnly &&
      (prev === '' ||
        REGEX_ALLOWED_AFTER.test(prev) ||
        REGEX_ALLOWED_AFTER_KEYWORD.test(source.slice(Math.max(0, prevEnd - 10), prevEnd)))
    ) {
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
      prevEnd = i;
      continue;
    }

    if (!WHITESPACE.test(c)) {
      prev = c;
      prevEnd = i + 1;
    }
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
