/**
 * Comment lexing for the dev-kit and core guards, the one place that decides what is a comment.
 * A scanner, not a regex pair: to a regex, `'settings/#/*'` or `/^item_(-?\d+)\//` opens a
 * comment. Both failure directions are silent, so `commentSpans.conformance.test.ts` checks it
 * against the TypeScript parser on every tracked file.
 */

/**
 * Where a regex literal may begin: after an operator or an opener, never after a value. `>` is in
 * for `x => /re/.test(x)`. `<` and `}` are out: `</div>` and `<Foo bar={1} />` end JSX elements, and
 * a regex opening a statement after a block is not a form this tree writes. `${` sets `prev` to `{`,
 * so an interpolated regex still opens.
 */
const REGEX_ALLOWED_AFTER = /[(,=:[!&|?{;+\-*%^~>]$/;

/**
 * A regex may also open after a keyword, whose last letter the operator test cannot see:
 * `return /re/.test(s)` is the common one, where reading the slash as division lets a URL
 * pattern's `\/\/` open a comment.
 */
const REGEX_ALLOWED_AFTER_KEYWORD =
  /\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/** Module level, since it is tested once per source character. */
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
   * Open template literals, innermost last, each with the `{` depth inside its current `${ … }`.
   * One loop scans code and interpolations alike, so every construct it knows, regex literals
   * above all, is known inside `${ … }` too.
   */
  const templates: { braces: number }[] = [];

  /**
   * A `'` or `"` string, which ends with its line when the closing quote never arrives: only a
   * template literal holds a raw newline. An apostrophe in JSX prose is where that happens. The
   * escape branch still consumes `\<newline>`, so a line continuation keeps working.
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

    // Inside a template's text: only its close, an escape and `${` matter.
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

    // A regex literal, whose body may hold `//` or `/*`, told from a division by what precedes it.
    // `blockOnly` is CSS, which has no regex literal: `calc(100% / 3)` would scan on and swallow
    // the next comment's `/*`.
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
  // Assembled once: a rebuild of the whole string per span is O(n x spans).
  const parts: string[] = [];
  let at = 0;
  for (const span of commentSpans(source)) {
    parts.push(source.slice(at, span.index));
    // Same length, newlines kept: every caller scans by offsets into the result.
    parts.push(span.text.replace(/[^\n]/g, ' '));
    at = span.index + span.text.length;
  }
  parts.push(source.slice(at));
  return parts.join('');
}
