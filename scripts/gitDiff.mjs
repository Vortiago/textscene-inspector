/** A user's git configuration can colour a diff, rename its prefixes or hand it to another program. */
export const PLAIN_DIFF = ['--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/'];

/** A hunk header, `@@ -a,b +c,d @@`: the removed count, the first new line and the added count. */
const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Git ends a file header with a tab when its path holds a space. */
const PATH_SPACE_TAB = /\t$/;

const C_ESCAPES = { n: '\n', t: '\t', r: '\r' };

/** Git quotes a path that holds a quote, a backslash or a control character, with C escapes and octal bytes. */
function unquotedPath(path) {
  if (!path.startsWith('"')) return path;
  const parts = path.slice(1, -1).split(/(\\[0-7]{3}|\\.)/);
  const bytes = parts.map((part) => {
    if (/^\\[0-7]{3}$/.test(part)) return Buffer.from([parseInt(part.slice(1), 8)]);
    if (part.startsWith('\\')) return Buffer.from(C_ESCAPES[part[1]] ?? part[1]);
    return Buffer.from(part);
  });
  return Buffer.concat(bytes).toString('utf8');
}

/** Git leaves a count of 1 out of a hunk header. */
const countOf = (digits) => (digits === undefined ? 1 : Number(digits));

/**
 * Each `{ path, line, text }` a diff adds. Hunk counts bound a body, so an added `+++ ` is no header.
 *
 * @canonical Read the lines a unified diff adds
 */
export function addedLines(diff) {
  const added = [];
  let path = '';
  let line = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const text of diff.split('\n')) {
    if (oldLeft + newLeft === 0) {
      const hunk = HUNK_HEADER.exec(text);
      if (hunk) {
        oldLeft = countOf(hunk[1]);
        line = Number(hunk[2]);
        newLeft = countOf(hunk[3]);
      } else if (text.startsWith('+++ ')) {
        path = unquotedPath(text.slice('+++ '.length).replace(PATH_SPACE_TAB, '')).slice('b/'.length);
      }
      continue;
    }
    const sign = text[0];
    if (sign === '+') added.push({ path, line, text: text.slice(1) });
    if (sign === '-' || sign === ' ') oldLeft -= 1;
    if (sign === '+' || sign === ' ') {
      newLeft -= 1;
      line += 1;
    }
  }
  return added;
}
